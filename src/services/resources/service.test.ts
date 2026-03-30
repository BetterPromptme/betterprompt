import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, mock } from "bun:test";

import type { TResourcesData } from "../../types/resources";
import {
  fetchResources,
  loadLocalResources,
  saveLocalResources,
} from "./service";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-resources-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  mock.restore();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

const sampleData: TResourcesData = {
  hash: "abc123",
  resources: {
    models: [
      {
        model: "model-1",
        modality: "text",
        availableRunOptions: [{ key: "mode", options: ["fast", "accurate"] }],
      },
      {
        model: "model-2",
        modality: "image",
        availableRunOptions: [{ key: "mode", options: ["standard"] }],
      },
    ],
  },
};

describe("fetchResources", () => {
  it("returns TResourcesData on SUCCESS response", async () => {
    const apiClient = {
      get: mock(async () => ({
        data: sampleData,
      })),
    };

    const result = await fetchResources(apiClient);

    expect(apiClient.get).toHaveBeenCalledWith("/resources");
    expect(result).toEqual(sampleData);
  });
});

describe("loadLocalResources", () => {
  it("returns parsed TResourcesData when file exists", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(tempDir, "resources.json");

    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(sampleData));

    const result = await loadLocalResources(filePath);

    expect(result).toEqual(sampleData);
  });

  it("returns null when file does not exist", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(tempDir, "nonexistent.json");

    const result = await loadLocalResources(filePath);

    expect(result).toBeNull();
  });

  it("returns null when file contains corrupted JSON", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(tempDir, "resources.json");

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, "not valid json{{{");

    const result = await loadLocalResources(filePath);

    expect(result).toBeNull();
  });
});

describe("saveLocalResources", () => {
  it("writes JSON to the specified path", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(tempDir, ".betterprompt", "resources.json");

    await saveLocalResources(sampleData, filePath);

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as TResourcesData;
    expect(parsed).toEqual(sampleData);
  });

  it("creates the directory if it does not exist", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(
      tempDir,
      ".betterprompt",
      "deep",
      "resources.json"
    );

    await saveLocalResources(sampleData, filePath);

    const raw = await readFile(filePath, "utf8");
    expect(JSON.parse(raw)).toEqual(sampleData);
  });
});
