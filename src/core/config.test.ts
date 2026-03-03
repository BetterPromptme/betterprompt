import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { API_CONFIG, SYSTEM_CONFIG } from "../constants";
import {
  getSystemConfigValue,
  getLoadedSystemConfig,
  loadOrInitConfig,
  resetSystemConfigForTests,
  resolveSystemConfigPath,
  setSystemConfigValue,
} from "./config";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-config-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  resetSystemConfigForTests();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("system config core", () => {
  it("resolves config path from home directory", () => {
    const configPath = resolveSystemConfigPath(() => "/tmp/demo-home");

    expect(configPath).toBe(
      path.join("/tmp/demo-home", ".betterprompt", "config.json")
    );
  });

  it("creates config file with defaults when missing", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    const config = await loadOrInitConfig({ configPath });
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(config).toEqual({
      version: SYSTEM_CONFIG.version,
      apiBaseUrl: API_CONFIG.baseUrl,
    });
    expect(parsed).toEqual(config);
  });

  it("auto-fills apiBaseUrl when missing", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({ version: "0.0.1" }, null, 2));

    const config = await loadOrInitConfig({ configPath });

    expect(config).toEqual({
      version: "0.0.1",
      apiBaseUrl: API_CONFIG.baseUrl,
    });
  });

  it("stores loaded config in memory for runtime usage", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    const loaded = await loadOrInitConfig({ configPath });

    expect(getLoadedSystemConfig()).toEqual(loaded);
    expect(getLoadedSystemConfig()?.apiBaseUrl).toBe(API_CONFIG.baseUrl);
  });

  it("sets and gets apiBaseUrl value", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(
      "apiBaseUrl",
      "https://runtime.example/api",
      { configPath }
    );

    const value = await getSystemConfigValue("apiBaseUrl", { configPath });
    expect(value).toBe("https://runtime.example/api");
  });

  it("getSystemConfigValue returns undefined for apiKey (stored in auth.json)", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    const value = await getSystemConfigValue("apiKey", { configPath });
    expect(value).toBeUndefined();
  });

  it("setSystemConfigValue throws for apiKey (should use saveAuthConfig)", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await expect(
      setSystemConfigValue("apiKey", "bp_test", { configPath })
    ).rejects.toThrow('Cannot set "apiKey" via system config.');
  });
});
