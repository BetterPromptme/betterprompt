import { confirm } from "@clack/prompts";
import { Command } from "commander";
import logSymbols from "log-symbols";
import { UNINSTALL_COMMAND, UNINSTALL_MESSAGES } from "../constants/uninstall";
import { getCommandContext } from "../core/context";
import { printResult } from "../core/output";
import { runUninstall as runUninstallCore } from "../core/uninstall";
import type { TUninstallCommandDependencies } from "../types/uninstall";

const defaultDeps: TUninstallCommandDependencies = {
  confirmUninstall: async () => {
    const response = await confirm({
      message: UNINSTALL_MESSAGES.confirmMessage,
      initialValue: false,
    });

    return response === true;
  },
  runUninstall: async (options) => runUninstallCore(options),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createUninstallCommand = (
  deps: TUninstallCommandDependencies = defaultDeps
): Command =>
  new Command(UNINSTALL_COMMAND.name)
    .description(UNINSTALL_COMMAND.description)
    .option("--yes", "Skip confirmation prompt")
    .option("--json", "Render output as JSON")
    .action(async (_opts: Record<string, unknown>, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const confirmed = ctx.yes ? true : await deps.confirmUninstall();

        if (!confirmed) {
          deps.printResult(UNINSTALL_MESSAGES.cancelled, ctx);
          return;
        }

        const result = await deps.runUninstall({
          force: true,
          registry: ctx.registry,
        });
        deps.printResult(result, ctx);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(
          `${logSymbols.error} ${UNINSTALL_MESSAGES.failedPrefix} ${errorMessage}`
        );
        deps.setExitCode(1);
      }
    });

export const uninstallCommand = createUninstallCommand();
