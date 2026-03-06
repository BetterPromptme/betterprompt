import type { TPrintOptions } from "./outputs";

export type TCheckForUpdateOptions = {
  registry?: string;
};

export type TCheckForUpdateResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
};

export type TPerformUpdateOptions = {
  registry?: string;
  targetVersion?: string;
};

export type TPerformUpdateResult = {
  updated: boolean;
};

export type TUpdateCommandDependencies = {
  checkForUpdate: (
    options?: TCheckForUpdateOptions
  ) => Promise<TCheckForUpdateResult>;
  performUpdate: (
    options?: TPerformUpdateOptions
  ) => Promise<TPerformUpdateResult>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
