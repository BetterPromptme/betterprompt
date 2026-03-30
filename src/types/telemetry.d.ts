import type { TSystemConfig } from "./config.d.ts";

export type TTelemetryEvent = {
  command: string;
  startedAt: number;
  metadata?: Record<string, unknown>;
};

export type TTelemetryConfig =
  | boolean
  | {
      enabled: boolean;
      commands?: string[];
    };

export type TTelemetryDependencies = {
  getConfig: () => Promise<TSystemConfig>;
  getEnv: (key: string) => string | undefined;
  fetch: typeof globalThis.fetch;
  getBaseUrl: () => string;
  getCliVersion: () => string;
  getPlatform: () => string;
  getArch: () => string;
  isCI: () => boolean;
};
