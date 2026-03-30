import type { TTelemetryConfig } from "./telemetry.d.ts";

export type TSystemConfig = {
  version: string;
  apiBaseUrl?: string;
  telemetry?: TTelemetryConfig;
};

export type TSystemConfigKey = "apiKey" | "apiBaseUrl" | "telemetry";

export type TLoadOrInitConfigOptions = {
  configPath?: string;
  getHomeDir?: () => string;
};
