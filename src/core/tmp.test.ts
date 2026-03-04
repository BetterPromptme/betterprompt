import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cleanupTmpDirectory } from "./tmp";

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "betterprompt-tmp-cleanup-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("cleanupTmpDirectory", () => {
  it("clears all files in tmp/", async () => {
    const root = await createTempRoot();
    const tmpPath = path.join(root, ".betterprompt", "tmp");

    await mkdir(path.join(tmpPath, "nested"), { recursive: true });
    await writeFile(path.join(tmpPath, "a.txt"), "alpha");
    await writeFile(path.join(tmpPath, "nested", "b.txt"), "bravo");

    await expect(cleanupTmpDirectory(tmpPath)).resolves.toBeUndefined();
    await expect(readdir(tmpPath)).resolves.toEqual([]);
  });

  it("does not error when tmp/ is empty", async () => {
    const root = await createTempRoot();
    const tmpPath = path.join(root, ".betterprompt", "tmp");

    await mkdir(tmpPath, { recursive: true });

    await expect(cleanupTmpDirectory(tmpPath)).resolves.toBeUndefined();
    await expect(readdir(tmpPath)).resolves.toEqual([]);
  });

  it("does not error when tmp/ does not exist", async () => {
    const root = await createTempRoot();
    const tmpPath = path.join(root, ".betterprompt", "tmp");

    await expect(cleanupTmpDirectory(tmpPath)).resolves.toBeUndefined();
  });

  it("removes only files in tmp/ and keeps sibling directories untouched", async () => {
    const root = await createTempRoot();
    const bpRoot = path.join(root, ".betterprompt");
    const tmpPath = path.join(bpRoot, "tmp");
    const skillsPath = path.join(bpRoot, "skills");
    const skillFile = path.join(skillsPath, "manifest.json");

    await mkdir(tmpPath, { recursive: true });
    await mkdir(skillsPath, { recursive: true });
    await writeFile(path.join(tmpPath, "temp.txt"), "temporary");
    await writeFile(skillFile, '{"name":"keep-me"}\n');

    await expect(cleanupTmpDirectory(tmpPath)).resolves.toBeUndefined();

    await expect(readdir(tmpPath)).resolves.toEqual([]);
    await expect(readFile(skillFile, "utf8")).resolves.toBe('{"name":"keep-me"}\n');
  });
});
