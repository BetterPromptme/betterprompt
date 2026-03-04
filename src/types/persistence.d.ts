import type { TPart } from "./output";
import type { TResolvedScope } from "./scope";

export type TPersistedAsset = {
  fileName: string;
  content: string;
};

export type THistoryEntry = {
  runId: string;
  skillName: string;
  runStatus: string;
  persistedAt: string;
  outputDir: string;
};

export type TPersistRunOutputArgs = {
  scope: TResolvedScope;
  now?: Date;
  runId: string;
  skillName: string;
  request: unknown;
  response: {
    runId: string;
    runStatus: string;
    outputs: TPart[];
  };
  metadata: unknown;
  assets?: TPersistedAsset[];
};

export type TPersistRunOutputResult = {
  outputDir: string;
  historyFilePath: string;
};

export type TShouldPersistRunOutputArgs = {
  saveRun?: boolean;
  outputs: TPart[];
};
