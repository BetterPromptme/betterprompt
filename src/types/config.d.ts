export type TSystemConfig = {
  version: string;
  apiBaseUrl?: string;
  telemetry?: boolean;
};

export type TSystemConfigKey = "apiKey" | "apiBaseUrl" | "telemetry";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
