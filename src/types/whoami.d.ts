import type { TPrintOptions } from "./outputs";

export type TUserIdentity = {
  username: string;
  displayName: string;
  userFlags: number;
};

export type TWhoamiDependencies = {
  getCurrentUser: () => Promise<TUserIdentity>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
