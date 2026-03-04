import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { UPDATE_COMMAND, UPDATE_MESSAGES } from "../constants/update";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import {
  checkForUpdate as checkForUpdateCore,
  performUpdate as performUpdateCore,
} from "../core/update";
import type { TUpdateCommandDependencies } from "../types/update";

const defaultDeps: TUpdateCommandDependencies = {
  checkForUpdate: (options) => checkForUpdateCore(options),
  performUpdate: (options) => performUpdateCore(options),
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
  command.option("--json", "Render output as JSON");

  command.action(async (_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const ctx = getCommandContext(cmd);
      const checkResult = await runTaskWithSpinner({
        message: "Checking for updates...",
        createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
        task: () =>
          deps.checkForUpdate({
            registry: ctx.registry,
          }),
      });

      let updated = false;
      if (checkResult.hasUpdate) {
        const updateResult = await runTaskWithSpinner({
          message: `Updating to ${checkResult.latestVersion}...`,
          createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () =>
            deps.performUpdate({
              registry: ctx.registry,
              targetVersion: checkResult.latestVersion,
            }),
        });
        updated = updateResult.updated;
      }

      deps.printResult(
        {
          currentVersion: checkResult.currentVersion,
          latestVersion: checkResult.latestVersion,
          hasUpdate: checkResult.hasUpdate,
          updated,
        },
        ctx
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      deps.error(
        `${logSymbols.error} ${UPDATE_MESSAGES.failedPrefix} ${errorMessage}`
      );
      deps.setExitCode(1);
    }
  });

  return command;
};

export const updateCommand = createUpdateCommand();
