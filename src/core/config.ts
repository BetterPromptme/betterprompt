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

const sanitizeConfig = (value: JsonObject): {
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

  const auth = isObjectRecord(value.auth) ? value.auth : {};
  if (auth !== value.auth) {
    changed = true;
  }

  const config: TSystemConfig = {
    version,
    apiBaseUrl,
    auth,
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
      auth: {},
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
    systemConfigCache = doLoadOrInitConfig();
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

const normalizeConfigApiKey = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(SYSTEM_MESSAGES.invalidApiKeyError);
  }
  return normalized;
};

const getApiKeyFromConfig = (config: TSystemConfig): string | undefined => {
  const authValue =
    typeof config.auth === "object" && config.auth !== null
      ? (config.auth as Record<string, unknown>).apiKey
      : undefined;

  if (typeof authValue === "string" && authValue.trim()) {
    return authValue.trim();
  }

  return undefined;
};

export const getSystemConfigValue = async (
  key: TSystemConfigKey,
  options: TLoadOrInitConfigOptions = {}
): Promise<string | undefined> => {
  const config = await loadOrInitConfig(options);

  if (key === "apiBaseUrl") {
    return config.apiBaseUrl;
  }

  return getApiKeyFromConfig(config);
};

export const setSystemConfigValue = async (
  key: TSystemConfigKey,
  value: string,
  options: TLoadOrInitConfigOptions = {}
): Promise<string> => {
  const configPath =
    options.configPath ?? resolveSystemConfigPath(options.getHomeDir);
  const existing = await loadOrInitConfig({ ...options, configPath });

  let nextConfig: TSystemConfig;
  if (key === "apiBaseUrl") {
    nextConfig = {
      ...existing,
      apiBaseUrl: normalizeApiBaseUrl(value),
    };
  } else {
    const apiKey = normalizeConfigApiKey(value);
    nextConfig = {
      ...existing,
      auth: {
        ...(typeof existing.auth === "object" && existing.auth
          ? existing.auth
          : {}),
        apiKey,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  await writeSystemConfig(configPath, nextConfig);
  loadedSystemConfig = nextConfig;
  return configPath;
};

export const resetSystemConfigForTests = (): void => {
  systemConfigCache = undefined;
  loadedSystemConfig = undefined;
};
