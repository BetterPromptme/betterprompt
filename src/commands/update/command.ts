import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { UPDATE_COMMAND, UPDATE_MESSAGES } from "../../constants/update";
import { getCommandContext } from "../../services/context/service";
import { runTaskWithSpinner } from "../../services/error-ux/service";
import { printResult } from "../../services/output/service";
import {
  checkForUpdate as checkForUpdateService,
  performUpdate as performUpdateService,
} from "../../services/update/service";
import type { TUpdateCommandDependencies } from "./types";

const defaultDeps: TUpdateCommandDependencies = {
  checkForUpdate: (options) => checkForUpdateService(options),
  performUpdate: (options) => performUpdateService(options),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createUpdateCommand = (
  deps: TUpdateCommandDependencies = defaultDeps
): Command => {
  const command = new Command(UPDATE_COMMAND.name).description(
    UPDATE_COMMAND.description
  );
  command.option(UPDATE_COMMAND.flags.json.flag, UPDATE_COMMAND.flags.json.description);

  command.action(async (_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const ctx = getCommandContext(cmd);
      const checkResult = await runTaskWithSpinner({
        message: "Checking for updates...",
        createSpinner: (message) =>
          ora({ text: message, isEnabled: process.stderr.isTTY }),
        task: () =>
          deps.checkForUpdate({
            registry: ctx.registry,
          }),
      });

      let updated = false;
      if (checkResult.hasUpdate) {
        const updateResult = await runTaskWithSpinner({
          message: `Updating to ${checkResult.latestVersion}...`,
          createSpinner: (message) =>
            ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () =>
            deps.performUpdate({
              registry: ctx.registry,
              targetVersion: checkResult.latestVersion,
            }),
        });
        updated = updateResult.updated;
      }

      const resultData = {
        currentVersion: checkResult.currentVersion,
        latestVersion: checkResult.latestVersion,
        hasUpdate: checkResult.hasUpdate,
        updated,
      };

      if (ctx.outputFormat === "json") {
        deps.printResult(resultData, ctx);
      } else if (updated) {
        deps.printResult(
          `${logSymbols.info} Updated to ${checkResult.latestVersion}`,
          ctx
        );
      } else {
        deps.printResult(`${logSymbols.info} Already up to date`, ctx);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      deps.error(
        `${logSymbols.error} ${UPDATE_MESSAGES.failedPrefix} ${errorMessage}`
      );
      deps.setExitCode(1);
    }
  });

  return command;
};

export const updateCommand = createUpdateCommand();
