import { confirm } from "@clack/prompts";
import { Command } from "commander";
import logSymbols from "log-symbols";
import { RESET_COMMAND, RESET_MESSAGES } from "../../constants/reset";
import { getCommandContext } from "../../services/context/service";
import { printResult } from "../../services/output/service";
import { runReset as runResetService } from "../../services/reset/service";
import type { TResetCommandDependencies } from "./types";

const defaultDeps: TResetCommandDependencies = {
  confirmReset: async () => {
    const response = await confirm({
      message: RESET_MESSAGES.confirmMessage,
      initialValue: false,
    });

    return response === true;
  },
  runReset: async (options) => runResetService(options),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createResetCommand = (
  deps: TResetCommandDependencies = defaultDeps
): Command =>
  new Command(RESET_COMMAND.name)
    .description(RESET_COMMAND.description)
    .option("--yes", "Skip confirmation prompt")
    .option(RESET_COMMAND.flags.json.flag, RESET_COMMAND.flags.json.description)
    .action(async (_opts: Record<string, unknown>, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const confirmed = ctx.yes ? true : await deps.confirmReset();

        if (!confirmed) {
          deps.printResult(RESET_MESSAGES.cancelled, ctx);
          return;
        }

        const result = await deps.runReset({
          force: true,
        });

        const output =
          ctx.outputFormat === "json"
            ? result
            : `${logSymbols.success} ${RESET_MESSAGES.success}`;
        deps.printResult(output, ctx);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(
          `${logSymbols.error} ${RESET_MESSAGES.failedPrefix} ${errorMessage}`
        );
        deps.setExitCode(1);
      }
    });

export const resetCommand = createResetCommand();
