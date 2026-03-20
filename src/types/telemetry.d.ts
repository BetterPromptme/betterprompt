import type { TSystemConfig } from "./config";

export type TTelemetryEvent = {
  event: string;
  skillSlug?: string;
  model?: string;
  success?: boolean;
  query?: string;
  resultCount?: number;
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
