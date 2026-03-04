import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { API_CONFIG, SYSTEM_CONFIG } from "../constants";
import type { TSystemConfigKey } from "../types";
import {
  getSystemConfigValue,
  getLoadedSystemConfig,
  loadOrInitConfig,
  resetSystemConfigForTests,
  resolveSystemConfigPath,
  setSystemConfigValue,
  unsetSystemConfigValue,
} from "./config";

const asConfigKey = (key: string): TSystemConfigKey =>
  key as unknown as TSystemConfigKey;

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

  it("unsets apiBaseUrl and keeps config file valid JSON", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await setSystemConfigValue("apiBaseUrl", "https://runtime.example/api", {
      configPath,
    });

    await unsetSystemConfigValue("apiBaseUrl", { configPath });

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(parsed.version).toBeDefined();
    expect(parsed.apiBaseUrl).toBeUndefined();
  });

  it("unsetSystemConfigValue throws when key does not exist", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await loadOrInitConfig({ configPath });

    await expect(
      unsetSystemConfigValue("apiBaseUrl", { configPath })
    ).rejects.toThrow("apiBaseUrl is not set in config.json.");
  });

  it("sets/gets/unsets default_output_format", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(
      asConfigKey("default_output_format"),
      "json",
      { configPath }
    );

    await expect(
      getSystemConfigValue(asConfigKey("default_output_format"), {
        configPath,
      })
    ).resolves.toBe("json");

    await unsetSystemConfigValue(asConfigKey("default_output_format"), {
      configPath,
    });
    await expect(
      getSystemConfigValue(asConfigKey("default_output_format"), {
        configPath,
      })
    ).resolves.toBeUndefined();
  });

  it("sets/gets/unsets cache_ttl_seconds", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(asConfigKey("cache_ttl_seconds"), "3600", {
      configPath,
    });

    await expect(
      getSystemConfigValue(asConfigKey("cache_ttl_seconds"), { configPath })
    ).resolves.toBe("3600");

    await unsetSystemConfigValue(asConfigKey("cache_ttl_seconds"), {
      configPath,
    });
    await expect(
      getSystemConfigValue(asConfigKey("cache_ttl_seconds"), { configPath })
    ).resolves.toBeUndefined();
  });

  it("sets/gets/unsets telemetry", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(asConfigKey("telemetry"), "true", {
      configPath,
    });

    await expect(
      getSystemConfigValue(asConfigKey("telemetry"), { configPath })
    ).resolves.toBe("true");

    await unsetSystemConfigValue(asConfigKey("telemetry"), { configPath });
    await expect(
      getSystemConfigValue(asConfigKey("telemetry"), { configPath })
    ).resolves.toBeUndefined();
  });

  it("accepts telemetry=false as a valid boolean value", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(asConfigKey("telemetry"), "false", {
      configPath,
    });

    await expect(
      getSystemConfigValue(asConfigKey("telemetry"), { configPath })
    ).resolves.toBe("false");
  });

  it("sets/gets/unsets skills_dir", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(asConfigKey("skills_dir"), "/tmp/skills", {
      configPath,
    });

    await expect(
      getSystemConfigValue(asConfigKey("skills_dir"), { configPath })
    ).resolves.toBe("/tmp/skills");

    await unsetSystemConfigValue(asConfigKey("skills_dir"), { configPath });
    await expect(
      getSystemConfigValue(asConfigKey("skills_dir"), { configPath })
    ).resolves.toBeUndefined();
  });

  it("rejects non-numeric cache_ttl_seconds with clear error", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await expect(
      setSystemConfigValue(asConfigKey("cache_ttl_seconds"), "abc", {
        configPath,
      })
    ).rejects.toThrow("cache_ttl_seconds must be a number.");
  });

  it("rejects non-boolean telemetry with clear error", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await expect(
      setSystemConfigValue(asConfigKey("telemetry"), "enabled", {
        configPath,
      })
    ).rejects.toThrow("telemetry must be a boolean.");
  });

  it("accepts cache_ttl_seconds=0 as a valid numeric value", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await setSystemConfigValue(asConfigKey("cache_ttl_seconds"), "0", {
      configPath,
    });

    await expect(
      getSystemConfigValue(asConfigKey("cache_ttl_seconds"), { configPath })
    ).resolves.toBe("0");
  });
});
