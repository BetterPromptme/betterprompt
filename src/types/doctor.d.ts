import type { TPrintOptions } from "./output";

export type TDoctorCheckName =
  | "auth"
  | "registry"
  | "dirs"
  | "permissions";

export type TDoctorCheckStatus = "pass" | "fail";

export type TDoctorCheck = {
  status: TDoctorCheckStatus;
  message: string;
  fix?: () => Promise<void>;
};

export type TDoctorCheckResult = {
  name: TDoctorCheckName;
  status: TDoctorCheckStatus;
  message: string;
  fixed?: boolean;
};

export type TDoctorResult = {
  healthy: boolean;
  checks: TDoctorCheckResult[];
};

export type TDoctorCoreDependencies = {
  checkAuth: () => Promise<TDoctorCheck>;
  checkRegistry: () => Promise<TDoctorCheck>;
  checkDirs: () => Promise<TDoctorCheck>;
  checkPermissions: () => Promise<TDoctorCheck>;
};

export type TRunDoctorChecksOptions = {
  fix?: boolean;
  deps?: TDoctorCoreDependencies;
};

export type TDoctorCommandOptions = {
  fix?: boolean;
};

export type TDoctorCommandDependencies = {
  runDoctorChecks: (options: TRunDoctorChecksOptions) => Promise<TDoctorResult>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
