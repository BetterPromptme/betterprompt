import type { TPart } from "./output";
import type { TResolvedScope } from "./scope";

export type THistoryEntry = {
  runId: string;
  skillVersionId: string;
  runStatus: string;
  createdAt: string;
  persistedAt: string;
  outputDir: string;
};

export type TPersistRunOutputArgs = {
  scope: TResolvedScope;
  now?: Date;
  runId: string;
  skillVersionId: string;
  request: unknown;
  response: {
    runId: string;
    runStatus: string;
    outputs: TPart[];
    createdAt?: string;
  };
  metadata: unknown;
};

export type TPersistRunOutputResult = {
  outputDir: string;
  historyFilePath: string;
};

export type TShouldPersistRunOutputArgs = {
  saveRun?: boolean;
  outputs: TPart[];
};
