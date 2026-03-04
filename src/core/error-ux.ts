import { Chalk } from "chalk";
import logSymbols from "log-symbols";
import type {
  TErrorFormatterOptions,
  TFormatErrorMessage,
  TInstallCtrlCHandlerOptions,
  TRunTaskWithSpinnerOptions,
  TSignalHandler,
} from "../types/error-ux";

const INTERRUPT_MESSAGE = "Interrupted (Ctrl+C). Exiting gracefully.";
const CTRL_C_EXIT_CODE = 130;

const createChalk = (color: boolean) =>
  new Chalk({ level: color ? 1 : 0 });

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
): (() => void) => {
  const handler: TSignalHandler = () => {
    options.cleanup();
    options.setExitCode(CTRL_C_EXIT_CODE);
    options.log(INTERRUPT_MESSAGE);
  };

  options.register("SIGINT", handler);

  return () => {
    options.unregister("SIGINT", handler);
  };
};
