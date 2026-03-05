import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { API_CONFIG, SYSTEM_CONFIG } from "../constants";
import { bootstrapGlobalDirectory } from "./bootstrap";

const createTempHome = async (): Promise<string> =>
  mkdtemp(path.join(os.tmpdir(), "betterprompt-bootstrap-"));

const getMode = async (targetPath: string): Promise<number> =>
  (await stat(targetPath)).mode & 0o777;

describe("global directory bootstrap", () => {
  it("creates all required directories and default files on a fresh system", async () => {
    const tempHome = await createTempHome();

    try {
      await bootstrapGlobalDirectory({
        getHomeDir: () => tempHome,
      });

      const rootDir = path.join(tempHome, ".betterprompt");
      const skillsDir = path.join(rootDir, "skills");
      const outputsDir = path.join(rootDir, "outputs");
      const logsDir = path.join(rootDir, "logs");
      const tmpDir = path.join(rootDir, "tmp");
      const configPath = path.join(rootDir, "config.json");
      const authPath = path.join(rootDir, "auth.json");

      await expect(stat(rootDir)).resolves.toBeDefined();
      await expect(stat(skillsDir)).resolves.toBeDefined();
      await expect(stat(outputsDir)).resolves.toBeDefined();
      await expect(stat(logsDir)).resolves.toBeDefined();
      await expect(stat(tmpDir)).resolves.toBeDefined();
      await expect(stat(configPath)).resolves.toBeDefined();
      await expect(stat(authPath)).resolves.toBeDefined();

      const configRaw = await readFile(configPath, "utf8");
      const authRaw = await readFile(authPath, "utf8");

      expect(JSON.parse(configRaw)).toEqual({
        version: SYSTEM_CONFIG.version,
        apiBaseUrl: API_CONFIG.baseUrl,
      });
      expect(JSON.parse(authRaw)).toEqual({});
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("is idempotent on repeated runs and keeps existing config values", async () => {
    const tempHome = await createTempHome();

    try {
      await bootstrapGlobalDirectory({
        getHomeDir: () => tempHome,
      });

      const rootDir = path.join(tempHome, ".betterprompt");
      const configPath = path.join(rootDir, "config.json");
      const authPath = path.join(rootDir, "auth.json");

      await writeFile(
        configPath,
        `${JSON.stringify(
          {
            version: "custom-version",
            apiBaseUrl: "https://registry.example/v2",
          },
          null,
          2
        )}\n`
      );
      await writeFile(authPath, `${JSON.stringify({ apiKey: "bp_live_custom" }, null, 2)}\n`);

      await expect(
        bootstrapGlobalDirectory({
          getHomeDir: () => tempHome,
        })
      ).resolves.toBeUndefined();

      const configRaw = await readFile(configPath, "utf8");
      const authRaw = await readFile(authPath, "utf8");

      expect(JSON.parse(configRaw)).toEqual({
        version: "custom-version",
        apiBaseUrl: "https://registry.example/v2",
      });
      expect(JSON.parse(authRaw)).toEqual({ apiKey: "bp_live_custom" });
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("removes skillsDir from existing config during bootstrap", async () => {
    const tempHome = await createTempHome();

    try {
      await bootstrapGlobalDirectory({
        getHomeDir: () => tempHome,
      });

      const rootDir = path.join(tempHome, ".betterprompt");
      const configPath = path.join(rootDir, "config.json");

      await writeFile(
        configPath,
        `${JSON.stringify(
          {
            version: "custom-version",
            apiBaseUrl: "https://registry.example/v2",
            skillsDir: "/tmp/custom-skills",
          },
          null,
          2
        )}\n`
      );

      await expect(
        bootstrapGlobalDirectory({
          getHomeDir: () => tempHome,
        })
      ).resolves.toBeUndefined();

      const configRaw = await readFile(configPath, "utf8");
      expect(JSON.parse(configRaw)).toEqual({
        version: "custom-version",
        apiBaseUrl: "https://registry.example/v2",
      });
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("creates bootstrap directories with 0o700 permissions", async () => {
    const tempHome = await createTempHome();

    try {
      await bootstrapGlobalDirectory({
        getHomeDir: () => tempHome,
      });

      const rootDir = path.join(tempHome, ".betterprompt");
      const expectedMode = 0o700;
      const directories = [
        rootDir,
        path.join(rootDir, "skills"),
        path.join(rootDir, "outputs"),
        path.join(rootDir, "logs"),
        path.join(rootDir, "tmp"),
      ];

      for (const directoryPath of directories) {
        await expect(getMode(directoryPath)).resolves.toBe(expectedMode);
      }
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });
});
