import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  API_CONFIG,
  SYSTEM_CONFIG,
  SYSTEM_MESSAGES,
  SYSTEM_STORAGE,
} from "../constants";
import type {
  TLoadOrInitConfigOptions,
  TSystemConfig,
  TSystemConfigKey,
} from "../types";

type JsonObject = Record<string, unknown>;

let systemConfigCache: Promise<TSystemConfig> | undefined;
let loadedSystemConfig: TSystemConfig | undefined;

export const resolveSystemConfigPath = (
  getHomeDir: () => string = os.homedir
): string =>
  path.join(
    getHomeDir(),
    SYSTEM_STORAGE.configDirName,
    SYSTEM_STORAGE.fileName
  );

const isObjectRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeConfig = (
  value: JsonObject
): {
  config: TSystemConfig;
  changed: boolean;
} => {
  let changed = false;

  const version =
    typeof value.version === "string" && value.version.trim()
      ? value.version.trim()
      : SYSTEM_CONFIG.version;
  if (version !== value.version) {
    changed = true;
  }

  const apiBaseUrl =
    typeof value.apiBaseUrl === "string" && value.apiBaseUrl.trim()
      ? value.apiBaseUrl.trim()
      : API_CONFIG.baseUrl;
  if (apiBaseUrl !== value.apiBaseUrl) {
    changed = true;
  }

  if (
    "default_output_format" in value ||
    "cache_ttl_seconds" in value ||
    "telemetry" in value
  ) {
    changed = true;
  }

  const rawSkillsDir =
    typeof value.skillsDir === "string"
      ? value.skillsDir
      : typeof value.skills_dir === "string"
        ? value.skills_dir
        : undefined;
  const skillsDir = typeof rawSkillsDir === "string" ? rawSkillsDir.trim() : "";
  if (
    (skillsDir || undefined) !== value.skillsDir ||
    "skills_dir" in value
  ) {
    changed = true;
  }

  const config: TSystemConfig = {
    version,
    apiBaseUrl,
    ...(skillsDir ? { skillsDir } : {}),
  };

  return { config, changed };
};

const readExistingConfig = async (
  configPath: string
): Promise<JsonObject | undefined> => {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isObjectRecord(parsed)) {
      throw new Error(SYSTEM_MESSAGES.configMustBeObjectError);
    }

    return parsed;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

const writeSystemConfig = async (
  configPath: string,
  data: TSystemConfig
): Promise<void> => {
  const configDir = path.dirname(configPath);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = `${configPath}.${SYSTEM_STORAGE.tempFilePrefix}-${process.pid}-${Date.now()}`;

  await mkdir(configDir, {
    recursive: true,
    mode: SYSTEM_STORAGE.directoryMode,
  });

  try {
    await writeFile(tempPath, serialized, { mode: SYSTEM_STORAGE.fileMode });
    await rename(tempPath, configPath);
    await chmod(configPath, SYSTEM_STORAGE.fileMode).catch(() => {});
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
};

const ensureRuntimeDirectories = async (configPath: string): Promise<void> => {
  const rootDir = path.dirname(configPath);
  const requiredDirectories = ["skills", "outputs", "logs", "tmp"];

  for (const name of requiredDirectories) {
    await mkdir(path.join(rootDir, name), {
      recursive: true,
      mode: SYSTEM_STORAGE.directoryMode,
    });
  }
};

const doLoadOrInitConfig = async (
  options: TLoadOrInitConfigOptions = {}
): Promise<TSystemConfig> => {
  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
  await ensureRuntimeDirectories(configPath);
  const existing = await readExistingConfig(configPath);

  if (!existing) {
    const nextConfig: TSystemConfig = {
      version: SYSTEM_CONFIG.version,
      apiBaseUrl: API_CONFIG.baseUrl,
    };

    await writeSystemConfig(configPath, nextConfig);
    return nextConfig;
  }

  const { config, changed } = sanitizeConfig(existing);
  if (changed) {
    await writeSystemConfig(configPath, config);
  }

  return config;
};

export const loadOrInitConfig = async (
  options: TLoadOrInitConfigOptions = {}
): Promise<TSystemConfig> => {
  if (options.configPath || options.getHomeDir) {
    const config = await doLoadOrInitConfig(options);
    loadedSystemConfig = config;
    return config;
  }

  if (!systemConfigCache) {
    systemConfigCache = doLoadOrInitConfig().catch((error) => {
      systemConfigCache = undefined;
      throw error;
    });
  }

  loadedSystemConfig = await systemConfigCache;
  return loadedSystemConfig;
};

export const getLoadedSystemConfig = (): TSystemConfig | undefined =>
  loadedSystemConfig;

const normalizeApiBaseUrl = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(SYSTEM_MESSAGES.invalidApiBaseUrlError);
  }
  return normalized;
};

const normalizeSkillsDir = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("skillsDir cannot be empty.");
  }
  return normalized;
};

export const getSystemConfigValue = async (
  key: TSystemConfigKey,
  options: TLoadOrInitConfigOptions = {}
): Promise<string | undefined> => {
  if (key === "apiKey") {
    return undefined;
  }
  const config = await loadOrInitConfig(options);
  if (key === "apiBaseUrl") {
    return config.apiBaseUrl;
  }
  if (key === "skillsDir") {
    return config.skillsDir;
  }
  return undefined;
};

export const setSystemConfigValue = async (
  key: TSystemConfigKey,
  value: string,
  options: TLoadOrInitConfigOptions = {}
): Promise<string> => {
  if (key === "apiKey") {
    throw new Error(
      `Cannot set "${key}" via system config. Use saveAuthConfig for API keys.`
    );
  }

  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
  const existing = await loadOrInitConfig({ ...options, configPath });
  const nextConfig: TSystemConfig = { ...existing };

  if (key === "apiBaseUrl") {
    nextConfig.apiBaseUrl = normalizeApiBaseUrl(value);
  } else if (key === "skillsDir") {
    nextConfig.skillsDir = normalizeSkillsDir(value);
  }

  await writeSystemConfig(configPath, nextConfig);
  loadedSystemConfig = nextConfig;
  return configPath;
};

export const unsetSystemConfigValue = async (
  key: TSystemConfigKey,
  options: TLoadOrInitConfigOptions = {}
): Promise<string> => {
  if (key === "apiKey") {
    throw new Error(
      `Cannot unset "${key}" via system config. API keys are stored in auth.json.`
    );
  }

  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
  const existing = await loadOrInitConfig({ ...options, configPath });

  const currentValue = (() => {
    if (key === "apiBaseUrl") {
      return existing.apiBaseUrl;
    }
    if (key === "skillsDir") {
      return existing.skillsDir;
    }
    return undefined;
  })();

  if (
    typeof currentValue !== "string" ||
    !currentValue.trim() ||
    (key === "apiBaseUrl" && currentValue === API_CONFIG.baseUrl)
  ) {
    throw new Error(`${key} is not set in config.json.`);
  }

  const nextConfig: TSystemConfig = {
    ...existing,
  };
  delete nextConfig[key];

  await writeSystemConfig(configPath, nextConfig);
  loadedSystemConfig = nextConfig;
  return configPath;
};

export const resetSystemConfigForTests = (): void => {
  systemConfigCache = undefined;
  loadedSystemConfig = undefined;
};
