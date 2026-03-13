import { Chalk } from "chalk";
import logSymbols from "log-symbols";

import type {
  TCtrlCHandle,
  TErrorFormatterOptions,
  TFormatErrorMessage,
  TInstallCtrlCHandlerOptions,
  TRunTaskWithSpinnerOptions,
  TSignalHandler,
} from "../../types/error-ux";

const INTERRUPT_MESSAGE = "Interrupted (Ctrl+C). Exiting gracefully.";
export const CTRL_C_EXIT_CODE = 130;

const createChalk = (color: boolean) => new Chalk({ level: color ? 1 : 0 });

export const createErrorFormatter = (
  options: TErrorFormatterOptions
): TFormatErrorMessage => {
  const scopedChalk = createChalk(options.color);

  return (prefix: string, message: string): string =>
    `${scopedChalk.red(logSymbols.error)} ${scopedChalk.red.bold(prefix)} ${scopedChalk.red(message)}`;
};

export const runTaskWithSpinner = async <TResult>(
  options: TRunTaskWithSpinnerOptions<TResult>
): Promise<TResult> => {
  const spinner = options.createSpinner(options.message).start();

  try {
    const result = await options.task();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
};

export const installCtrlCHandler = (
  options: TInstallCtrlCHandlerOptions
): TCtrlCHandle => {
  let paused = false;

  const handler: TSignalHandler = () => {
    if (paused) return;
    options.cleanup();
    options.setExitCode(CTRL_C_EXIT_CODE);
    options.log(INTERRUPT_MESSAGE);
  };

  options.register("SIGINT", handler);

  return {
    uninstall: () => {
      options.unregister("SIGINT", handler);
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
  };
};
