import ora from "ora";

import type { TCommandFactoryDeps } from "../../types/command-factory";
import { printResult } from "../output/service";

export const createDefaultCommandFactoryDeps = (): TCommandFactoryDeps => ({
  createSpinner: (message) =>
    ora({ text: message, isEnabled: process.stderr.isTTY }),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
});
