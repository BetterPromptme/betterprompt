import type { TPrintOptions } from "./output";

export type TRunUninstallOptions = {
  force: boolean;
  registry?: string;
};

export type TRunUninstallResult = {
  removedPath: string;
  removedPackage: boolean;
  confirmed: boolean;
};

export type TUninstallCoreDependencies = {
  removeDirectory: (targetPath: string) => Promise<void>;
  uninstallPackage: (
    packageName: string,
    registry?: string
  ) => Promise<void>;
};

export type TRunUninstallCoreOptions = {
  force?: boolean;
  registry?: string;
  deps?: TUninstallCoreDependencies;
};

export type TUninstallCommandDependencies = {
  confirmUninstall: () => Promise<boolean>;
  runUninstall: (
    options: TRunUninstallOptions
  ) => Promise<TRunUninstallResult>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
