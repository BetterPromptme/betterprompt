import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PART_TYPE } from "../enums";
import {
  persistRunOutput,
  readPersistedRunOutput,
  shouldPersistRunOutput,
} from "./persistence";

type TPersistRunOutputArgs = Parameters<typeof persistRunOutput>[0];

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
  skillVersionId: "skill-version-123",
  request: {
    skillVersionId: "skill-version-123",
    input: ["topic=agentic-ai"],
    model: "gpt-5",
    saveRun: true,
  },
  response: {
    runId: "run_abc123",
    runStatus: "SUCCEEDED",
    outputs: [{ type: PART_TYPE.TEXT, data: "Generated copy" }],
    createdAt: "2026-03-04T11:59:00.000Z",
  },
  metadata: {
    runStatus: "SUCCEEDED",
    persistedAt: "2026-03-04T12:00:00.000Z",
  },
});

describe("persistRunOutput", () => {
  it("creates output folder at outputs/<runId>/", async () => {
    const rootDir = await createTempDir();
    const result = await persistRunOutput(createPersistArgs(rootDir));

    expect(result.outputDir).toBe(path.join(rootDir, "outputs", "run_abc123"));
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

  it("does not create assets/ subdirectory", async () => {
    const rootDir = await createTempDir();
    const result = await persistRunOutput(createPersistArgs(rootDir));

    await expect(
      readFile(path.join(result.outputDir, "assets", "image-1.txt"), "utf8")
    ).rejects.toMatchObject({ code: "ENOENT" });
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
      createdAt: "2026-03-04T12:00:00.000Z",
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
      skillVersionId: "skill-version-123",
      createdAt: "2026-03-04T11:59:00.000Z",
      outputDir: path.join("outputs", "run_abc123"),
    });
    expect(latest).toMatchObject({
      runId: "run_def456",
      skillVersionId: "skill-version-123",
      createdAt: "2026-03-04T12:00:00.000Z",
      outputDir: path.join("outputs", "run_def456"),
    });
  });

  it("updates existing history entry when runId already exists", async () => {
    const rootDir = await createTempDir();
    const base = createPersistArgs(rootDir);

    await persistRunOutput(base);

    await persistRunOutput({
      ...base,
      now: new Date("2026-03-04T12:10:00.000Z"),
      response: {
        ...base.response,
        runStatus: "FAILED",
      },
      metadata: {
        runStatus: "FAILED",
        persistedAt: "2026-03-04T12:10:00.000Z",
      },
    });

    const historyRaw = await readFile(
      path.join(rootDir, "outputs", "history.jsonl"),
      "utf8"
    );
    const lines = historyRaw.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry).toMatchObject({
      runId: "run_abc123",
      runStatus: "FAILED",
      persistedAt: "2026-03-04T12:10:00.000Z",
      outputDir: path.join("outputs", "run_abc123"),
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

  it("uses runId as-is for folder name", async () => {
    const rootDir = await createTempDir();
    const result = await persistRunOutput({
      ...createPersistArgs(rootDir),
      runId: "output_abc123",
      response: {
        runId: "output_abc123",
        runStatus: "SUCCEEDED",
        outputs: [{ type: PART_TYPE.TEXT, data: "Generated copy" }],
      },
    });

    expect(result.outputDir).toBe(path.join(rootDir, "outputs", "output_abc123"));

    const historyRaw = await readFile(
      path.join(rootDir, "outputs", "history.jsonl"),
      "utf8"
    );
    const entry = JSON.parse(historyRaw.trim());
    expect(entry).toMatchObject({
      runId: "output_abc123",
      outputDir: path.join("outputs", "output_abc123"),
    });
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

describe("readPersistedRunOutput", () => {
  it("reads outputs/<runId>/response.json as run result", async () => {
    const rootDir = await createTempDir();
    const args = createPersistArgs(rootDir);
    await persistRunOutput(args);

    const run = await readPersistedRunOutput({
      rootDir,
      runId: args.runId,
    });

    expect(run.runId).toBe(args.response.runId);
    expect(run.outputs).toEqual(args.response.outputs);
    expect(run.createdAt).toBe(
      args.response.createdAt ?? new Date(0).toISOString()
    );
    expect(String(run.runStatus)).toBe(args.response.runStatus);
    expect(run.promptVersionId).toBe("-");
  });

  it("throws when response.json is missing", async () => {
    const rootDir = await createTempDir();

    await expect(
      readPersistedRunOutput({
        rootDir,
        runId: "run_missing",
      })
    ).rejects.toThrow("Run not found in local persistence: run_missing");
  });
});
