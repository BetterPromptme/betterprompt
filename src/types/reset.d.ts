import type { TPrintOptions } from "./output";

export type TRunResetOptions = {
  force: boolean;
};

export type TRunResetResult = {
  removedPath: string;
  confirmed: boolean;
};

export type TResetCoreDependencies = {
  removeDirectory: (targetPath: string) => Promise<void>;
};

export type TRunResetCoreOptions = {
  force?: boolean;
  deps?: TResetCoreDependencies;
};

export type TResetCommandDependencies = {
  confirmReset: () => Promise<boolean>;
  runReset: (options: TRunResetOptions) => Promise<TRunResetResult>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
