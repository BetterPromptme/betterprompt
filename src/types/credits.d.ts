import type { TPrintOptions } from "./output";

export type TCreditBalance = {
  credits: number;
};

export type TCreditsDependencies = {
  getCredits: () => Promise<TCreditBalance>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
