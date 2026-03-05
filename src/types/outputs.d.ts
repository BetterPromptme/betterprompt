import type { TPrintOptions } from "./output";
import type { TRunResult } from "./run";
import type { RunStatus } from "../enums/run-status";
import type { TPersistRunOutputArgs, TPersistRunOutputResult } from "./persistence";
import type { TResolveScope } from "./scope";

export type TOutputsCommandOptions = {
  sync?: boolean;
  remote?: boolean;
};

export type TOutputsListCommandOptions = {
  remote?: boolean;
  status?: RunStatus;
  limit?: string;
  since?: string;
};

export type TOutputListFilters = {
  remote?: boolean;
  status?: RunStatus;
  limit?: number;
  since?: string;
};

export type TOutputListItem = {
  runId: string;
  skillVersionId: string;
  runStatus: RunStatus;
  createdAt: string;
};

export type TOutputHistoryEntry = {
  runId: string;
  skillVersionId?: string;
  runStatus?: string;
  createdAt?: string;
  persistedAt?: string;
  outputPath?: string;
  outputDir?: string;
};

export type TOutputListRow = TOutputListItem & {
  localOutputPath?: string;
};

export type TOutputsCommandDependencies = {
  resolveScope: TResolveScope;
  fetchRun: (
    runId: string,
    opts?: { remote?: boolean; rootDir?: string }
  ) => Promise<TRunResult>;
  persistRunOutput: (
    args: TPersistRunOutputArgs
  ) => Promise<TPersistRunOutputResult>;
  listOutputs: (filters: TOutputListFilters) => Promise<TOutputListItem[]>;
  readHistoryEntries: (rootDir: string) => Promise<TOutputHistoryEntry[]>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
