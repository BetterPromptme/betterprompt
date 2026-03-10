import type { TCliContext } from "./context";
import type { TSpinnerFactory } from "./error-ux";

export type TCommandFactoryDeps = {
  createSpinner: TSpinnerFactory;
  printResult: (data: unknown, ctx: TCliContext) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
