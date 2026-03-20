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
} from "../../constants";
import type {
  TLoadOrInitConfigOptions,
  TSystemConfig,
  TSystemConfigKey,
} from "../../types/config";

type TJsonObject = Record<string, unknown>;

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

const isObjectRecord = (value: unknown): value is TJsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeConfig = (
  value: TJsonObject
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

  const telemetry =
    typeof value.telemetry === "boolean" ? value.telemetry : undefined;

  if (
    "default_output_format" in value ||
    "cache_ttl_seconds" in value ||
    "skillsDir" in value ||
    "skills_dir" in value
  ) {
    changed = true;
  }

  const config: TSystemConfig = {
    version,
    apiBaseUrl,
    ...(telemetry !== undefined && { telemetry }),
  };

  return { config, changed };
};

const readExistingConfig = async (
  configPath: string
): Promise<TJsonObject | undefined> => {
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

const doLoadOrInitConfig = async (
  options: TLoadOrInitConfigOptions = {}
): Promise<TSystemConfig> => {
  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
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
  if (key === "telemetry") {
    return config.telemetry === undefined
      ? undefined
      : String(config.telemetry);
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
  }

  if (key === "telemetry") {
    if (value !== "true" && value !== "false") {
      throw new Error(
        `Invalid value "${value}" for telemetry. Expected "true" or "false".`
      );
    }
    nextConfig.telemetry = value === "true";
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
  if (key !== "apiBaseUrl" && key !== "telemetry") {
    throw new Error(
      `Cannot unset "${key}" via system config. Only "apiBaseUrl" and "telemetry" can be unset.`
    );
  }

  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
  const existing = await loadOrInitConfig({ ...options, configPath });

  if (key === "telemetry") {
    if (existing.telemetry === undefined) {
      throw new Error(`${key} is not set in config.json.`);
    }
    const nextConfig: TSystemConfig = {
      version: existing.version,
      ...(existing.apiBaseUrl && { apiBaseUrl: existing.apiBaseUrl }),
    };
    await writeSystemConfig(configPath, nextConfig);
    loadedSystemConfig = nextConfig;
    return configPath;
  }

  const currentValue = existing.apiBaseUrl;

  if (
    typeof currentValue !== "string" ||
    !currentValue.trim() ||
    currentValue === API_CONFIG.baseUrl
  ) {
    throw new Error(`${key} is not set in config.json.`);
  }

  const nextConfig: TSystemConfig = {
    version: existing.version,
    ...(existing.telemetry !== undefined && { telemetry: existing.telemetry }),
  };

  await writeSystemConfig(configPath, nextConfig);
  loadedSystemConfig = nextConfig;
  return configPath;
};

export const resetSystemConfigForTests = (): void => {
  systemConfigCache = undefined;
  loadedSystemConfig = undefined;
};
