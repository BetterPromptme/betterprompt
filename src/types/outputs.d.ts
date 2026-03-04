import type { TPrintOptions, TPart } from "./output";
import type { TRunResult } from "./run";
import type { RunStatus } from "../enums/run-status";

export type TOutputsCommandOptions = {
  out?: string;
};

export type TOutputsListCommandOptions = {
  skill?: string;
  status?: RunStatus;
  limit?: string;
  since?: string;
};

export type TOutputDownloadResult = {
  outputPath: string;
  downloadedFiles: string[];
};

export type TOutputFetchResult = TRunResult &
  TOutputDownloadResult & {
    outputs: TPart[];
  };

export type TOutputListFilters = {
  skill?: string;
  status?: RunStatus;
  limit?: number;
  since?: string;
};

export type TOutputListItem = {
  runId: string;
  skillName: string;
  runStatus: RunStatus;
  createdAt: string;
};

export type TOutputHistoryEntry = {
  runId: string;
  outputPath?: string;
  outputDir?: string;
};

export type TOutputListRow = TOutputListItem & {
  localOutputPath?: string;
};

export type TOutputsCommandDependencies = {
  fetchRun: (runId: string) => Promise<TRunResult>;
  downloadAssets: (
    run: TRunResult,
    outputPath?: string
  ) => Promise<TOutputDownloadResult>;
  listOutputs: (filters: TOutputListFilters) => Promise<TOutputListItem[]>;
  readHistoryEntries: () => Promise<TOutputHistoryEntry[]>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
