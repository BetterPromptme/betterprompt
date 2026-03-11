import logSymbols from "log-symbols";
import { UPDATE_COMMAND, UPDATE_MESSAGES } from "../../constants/update";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { runTaskWithSpinner } from "../../services/error-ux/service";
import {
  checkForUpdate as checkForUpdateService,
  performUpdate as performUpdateService,
} from "../../services/update/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TUpdateCommandDependencies } from "./types";

const defaultDeps: TUpdateCommandDependencies = {
  checkForUpdate: (options) => checkForUpdateService(options),
  performUpdate: (options) => performUpdateService(options),
};

export const createUpdateCommand = (
  deps: TUpdateCommandDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: UPDATE_COMMAND.name,
      description: UPDATE_COMMAND.description,
      flags: UPDATE_COMMAND.flags,
      errorPrefix: `${logSymbols.error} ${UPDATE_MESSAGES.failedPrefix}`,
      handler: async ({ ctx, deps: factoryDeps }) => {
        const checkResult = await runTaskWithSpinner({
          message: "Checking for updates...",
          createSpinner: factoryDeps.createSpinner,
          task: () => deps.checkForUpdate({ registry: ctx.registry }),
        });

        let updated = false;
        if (checkResult.hasUpdate) {
          const updateResult = await runTaskWithSpinner({
            message: `Updating to ${checkResult.latestVersion}...`,
            createSpinner: factoryDeps.createSpinner,
            task: () =>
              deps.performUpdate({
                registry: ctx.registry,
                targetVersion: checkResult.latestVersion,
              }),
          });
          updated = updateResult.updated;
        }

        return {
          currentVersion: checkResult.currentVersion,
          latestVersion: checkResult.latestVersion,
          hasUpdate: checkResult.hasUpdate,
          updated,
        };
      },
      formatText: (result) => {
        const r = result as {
          updated: boolean;
          latestVersion: string;
        };
        if (r.updated) {
          return `${logSymbols.info} Updated to ${r.latestVersion}`;
        }
        return `${logSymbols.info} Already up to date`;
      },
    },
    factoryDeps
  );

export const updateCommand = createUpdateCommand();
