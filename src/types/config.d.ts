export type TSystemConfig = {
  version: string;
  apiBaseUrl: string;
};

export type TSystemConfigKey = "apiKey" | "apiBaseUrl";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
