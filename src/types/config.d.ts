export type TSystemConfig = {
  version: string;
  apiBaseUrl?: string;
  skillsDir?: string;
};

export type TSystemConfigKey =
  | "apiKey"
  | "apiBaseUrl"
  | "skillsDir";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
