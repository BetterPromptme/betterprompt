export type TSystemConfig = {
  version: string;
  apiBaseUrl?: string;
  default_output_format?: string;
  cache_ttl_seconds?: string;
  telemetry?: string;
  skills_dir?: string;
};

export type TSystemConfigKey =
  | "apiKey"
  | "apiBaseUrl"
  | "default_output_format"
  | "cache_ttl_seconds"
  | "telemetry"
  | "skills_dir";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
