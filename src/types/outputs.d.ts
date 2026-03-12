import type { PartType } from "../enums";
import type { RunStatus } from "../enums/run-status";
import type {
  TPersistRunOutputArgs,
  TPersistRunOutputResult,
} from "./persistence";
import type { TRunResult } from "./run";
import type { TResolveScope } from "./scope";

export type TOutputFormat = "text" | "json";

export type TPrintOptions = {
  outputFormat: TOutputFormat;
};

export type TTextPart = {
  type: PartType.TEXT;
  data: string;
  thoughtSignature?: string;
};

export type TImagePart = {
  type: PartType.IMAGE;
  /**
   * The s3 key of the image
   */
  data: string;
};

export type TErrorPart = {
  type: PartType.ERROR;
  data: string;
};

export type TVideoPart = {
  type: PartType.VIDEO;
  /**
   * The s3 key of the video
   */
  data: string;
};

export type TPart = TTextPart | TImagePart | TErrorPart | TVideoPart;

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
};
