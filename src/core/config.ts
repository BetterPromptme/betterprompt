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

  const defaultOutputFormat =
    typeof value.default_output_format === "string"
      ? value.default_output_format.trim()
      : "";
  if (
    (defaultOutputFormat || undefined) !== value.default_output_format
  ) {
    changed = true;
  }

  const cacheTtlSeconds = (() => {
    if (typeof value.cache_ttl_seconds === "number") {
      return Number.isFinite(value.cache_ttl_seconds)
        ? String(value.cache_ttl_seconds)
        : undefined;
    }
    if (typeof value.cache_ttl_seconds === "string") {
      const normalized = value.cache_ttl_seconds.trim();
      if (!normalized) {
        return undefined;
      }
      const asNumber = Number(normalized);
      return Number.isFinite(asNumber) ? normalized : undefined;
    }
    return undefined;
  })();
  if (
    (cacheTtlSeconds || undefined) !== value.cache_ttl_seconds
  ) {
    changed = true;
  }

  const telemetry = (() => {
    if (typeof value.telemetry === "boolean") {
      return String(value.telemetry);
    }
    if (typeof value.telemetry === "string") {
      const normalized = value.telemetry.trim().toLowerCase();
      if (normalized === "true" || normalized === "false") {
        return normalized;
      }
    }
    return undefined;
  })();
  if ((telemetry || undefined) !== value.telemetry) {
    changed = true;
  }

  const skillsDir =
    typeof value.skills_dir === "string" ? value.skills_dir.trim() : "";
  if ((skillsDir || undefined) !== value.skills_dir) {
    changed = true;
  }

  const config: TSystemConfig = {
    version,
    apiBaseUrl,
    ...(defaultOutputFormat
      ? { default_output_format: defaultOutputFormat }
      : {}),
    ...(cacheTtlSeconds ? { cache_ttl_seconds: cacheTtlSeconds } : {}),
    ...(telemetry ? { telemetry } : {}),
    ...(skillsDir ? { skills_dir: skillsDir } : {}),
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

const normalizeDefaultOutputFormat = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("default_output_format cannot be empty.");
  }
  return normalized;
};

const normalizeCacheTtlSeconds = (value: string): string => {
  const normalized = value.trim();
  if (!normalized || !Number.isFinite(Number(normalized))) {
    throw new Error("cache_ttl_seconds must be a number.");
  }
  return normalized;
};

const normalizeTelemetry = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "true" && normalized !== "false") {
    throw new Error("telemetry must be a boolean.");
  }
  return normalized;
};

const normalizeSkillsDir = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("skills_dir cannot be empty.");
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
  if (key === "default_output_format") {
    return config.default_output_format;
  }
  if (key === "cache_ttl_seconds") {
    return config.cache_ttl_seconds;
  }
  if (key === "telemetry") {
    return config.telemetry;
  }
  if (key === "skills_dir") {
    return config.skills_dir;
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
  } else if (key === "default_output_format") {
    nextConfig.default_output_format = normalizeDefaultOutputFormat(value);
  } else if (key === "cache_ttl_seconds") {
    nextConfig.cache_ttl_seconds = normalizeCacheTtlSeconds(value);
  } else if (key === "telemetry") {
    nextConfig.telemetry = normalizeTelemetry(value);
  } else if (key === "skills_dir") {
    nextConfig.skills_dir = normalizeSkillsDir(value);
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
    if (key === "default_output_format") {
      return existing.default_output_format;
    }
    if (key === "cache_ttl_seconds") {
      return existing.cache_ttl_seconds;
    }
    if (key === "telemetry") {
      return existing.telemetry;
    }
    if (key === "skills_dir") {
      return existing.skills_dir;
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
