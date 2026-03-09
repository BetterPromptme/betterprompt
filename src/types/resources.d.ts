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
  resources: {
    models: TResourceModel[];
  };
};

export type TResourcesOpts = {
  remote?: boolean;
  sync?: boolean;
  modelsOnly?: boolean;
  json?: boolean;
};

export type TResourcesDependencies = {
  fetchResources: () => Promise<TResourcesData>;
  loadLocalResources: () => Promise<TResourcesData | null>;
  saveLocalResources: (data: TResourcesData) => Promise<void>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
