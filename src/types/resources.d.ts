import type { TPrintOptions } from "./outputs";

export type TResourceModel = {
  model: string;
  modality: string;
  availableRunOptions: {
    key: string;
    options: string[];
  }[];
};

export type TResourcesData = {
  hash: string;
  resources: {
    models: TResourceModel[];
    [key: string]: unknown;
  };
};

export type TResourcesDependencies = {
  fetchResources: (opts?: { skipModelsHash?: boolean }) => Promise<TResourcesData>;
  loadLocalResources: () => Promise<TResourcesData | null>;
  saveLocalResources: (data: TResourcesData) => Promise<void>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
