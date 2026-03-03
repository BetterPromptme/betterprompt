export type TSystemConfig = {
  version: string;
  apiBaseUrl: string;
  auth: Record<string, unknown>;
};

export type TSystemConfigKey = "apiKey" | "apiBaseUrl";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
