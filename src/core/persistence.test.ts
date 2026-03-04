import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PART_TYPE } from "../enums";
import { persistRunOutput, shouldPersistRunOutput } from "./persistence";

type TPersistRunOutputArgs = Parameters<typeof persistRunOutput>[0];

type TPersistedAsset = {
  fileName: string;
  content: string;
};

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-persistence-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  mock.restore();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

const createPersistArgs = (rootDir: string): TPersistRunOutputArgs => ({
  scope: {
    type: "project",
    rootDir,
  },
  now: new Date("2026-03-04T12:00:00.000Z"),
  runId: "run_abc123",
  skillName: "seo-blog-writer",
  request: {
    skillName: "seo-blog-writer",
    input: ["topic=agentic-ai"],
    model: "gpt-5",
    saveRun: true,
  },
  response: {
    runId: "run_abc123",
    runStatus: "SUCCEEDED",
    outputs: [{ type: PART_TYPE.TEXT, data: "Generated copy" }],
  },
  metadata: {
    runStatus: "SUCCEEDED",
    persistedAt: "2026-03-04T12:00:00.000Z",
  },
  assets: [{ fileName: "preview.txt", content: "Rendered preview" }],
});

describe("persistRunOutput", () => {
  it("creates output folder at outputs/<year>/<month>/output_<id>/", async () => {
    const rootDir = await createTempDir();
    const result = await persistRunOutput(createPersistArgs(rootDir));

    expect(result.outputDir).toBe(
      path.join(rootDir, "outputs", "2026", "03", "output_run_abc123")
    );
  });

  it("writes request.json, response.json, and metadata.json", async () => {
    const rootDir = await createTempDir();
    const args = createPersistArgs(rootDir);
    const result = await persistRunOutput(args);

    await expect(readFile(path.join(result.outputDir, "request.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(args.request, null, 2)}\n`
    );
    await expect(readFile(path.join(result.outputDir, "response.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(args.response, null, 2)}\n`
    );
    await expect(readFile(path.join(result.outputDir, "metadata.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(args.metadata, null, 2)}\n`
    );
  });

  it("saves assets to assets/ subdirectory", async () => {
    const rootDir = await createTempDir();
    const assets: TPersistedAsset[] = [
      { fileName: "image-1.txt", content: "asset-one" },
      { fileName: "image-2.txt", content: "asset-two" },
    ];

    const result = await persistRunOutput({
      ...createPersistArgs(rootDir),
      assets,
    });

    await expect(
      readFile(path.join(result.outputDir, "assets", "image-1.txt"), "utf8")
    ).resolves.toBe("asset-one");
    await expect(
      readFile(path.join(result.outputDir, "assets", "image-2.txt"), "utf8")
    ).resolves.toBe("asset-two");
  });

  it("appends a history entry to outputs/history.jsonl", async () => {
    const rootDir = await createTempDir();

    await persistRunOutput(createPersistArgs(rootDir));

    const second = createPersistArgs(rootDir);
    second.runId = "run_def456";
    second.response = {
      runId: "run_def456",
      runStatus: "SUCCEEDED",
      outputs: [{ type: PART_TYPE.IMAGE, data: "outputs/run_def456/image.png" }],
    };
    await persistRunOutput(second);

    const historyRaw = await readFile(
      path.join(rootDir, "outputs", "history.jsonl"),
      "utf8"
    );

    const lines = historyRaw.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0] ?? "{}");
    const latest = JSON.parse(lines[1] ?? "{}");

    expect(first).toMatchObject({
      runId: "run_abc123",
      outputDir: path.join("outputs", "2026", "03", "output_run_abc123"),
    });
    expect(latest).toMatchObject({
      runId: "run_def456",
      outputDir: path.join("outputs", "2026", "03", "output_run_def456"),
    });
  });

  it("writes under the provided scope root for project and global roots", async () => {
    const projectRoot = await createTempDir();
    const globalRoot = await createTempDir();

    const projectResult = await persistRunOutput({
      ...createPersistArgs(projectRoot),
      scope: { type: "project", rootDir: projectRoot },
      runId: "run_project",
    });

    const globalResult = await persistRunOutput({
      ...createPersistArgs(globalRoot),
      scope: { type: "global", rootDir: globalRoot },
      runId: "run_global",
    });

    expect(projectResult.outputDir.startsWith(projectRoot)).toBe(true);
    expect(globalResult.outputDir.startsWith(globalRoot)).toBe(true);
    expect(projectResult.outputDir).not.toBe(globalResult.outputDir);
  });
});

describe("shouldPersistRunOutput", () => {
  it("returns true for text-only outputs when --save-run is true", () => {
    const value = shouldPersistRunOutput({
      saveRun: true,
      outputs: [{ type: PART_TYPE.TEXT, data: "text" }],
    });

    expect(value).toBe(true);
  });

  it("returns false for text-only outputs when --save-run is false", () => {
    const value = shouldPersistRunOutput({
      saveRun: false,
      outputs: [{ type: PART_TYPE.TEXT, data: "text" }],
    });

    expect(value).toBe(false);
  });

  it("always returns true for non-text outputs", () => {
    expect(
      shouldPersistRunOutput({
        saveRun: false,
        outputs: [{ type: PART_TYPE.IMAGE, data: "outputs/run/image.png" }],
      })
    ).toBe(true);

    expect(
      shouldPersistRunOutput({
        saveRun: false,
        outputs: [{ type: PART_TYPE.VIDEO, data: "outputs/run/video.mp4" }],
      })
    ).toBe(true);
  });

  it("returns true when outputs include both text and non-text parts", () => {
    const value = shouldPersistRunOutput({
      saveRun: false,
      outputs: [
        { type: PART_TYPE.TEXT, data: "summary" },
        { type: PART_TYPE.IMAGE, data: "outputs/run/image.png" },
      ],
    });

    expect(value).toBe(true);
  });

  it("returns false when outputs are empty and --save-run is false", () => {
    const value = shouldPersistRunOutput({
      saveRun: false,
      outputs: [],
    });

    expect(value).toBe(false);
  });
});
