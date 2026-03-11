import logSymbols from "log-symbols";
import { CONFIG_COMMAND, CONFIG_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { parseConfigKey } from "../utils";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TConfigCommandDependencies, TConfigSubcommandOpts, TSystemConfigKey } from "../types";

export const createConfigSetSubcommand = (
  deps: TConfigCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const configSet = CONFIG_COMMAND.subcommands.set;

  return createCommandFromSpec<TConfigSubcommandOpts>(
    {
      name: configSet.name,
      description: configSet.description,
      flags: configSet.flags,
      arguments: [
        {
          name: configSet.arguments.key.name,
          description: configSet.arguments.key.description,
          parse: parseConfigKey as (v: string) => unknown,
        },
        {
          name: configSet.arguments.value.name,
          description: configSet.arguments.value.description,
        },
      ],
      errorPrefix: CONFIG_MESSAGES.failedPrefix,
      formatText: () =>
        `${logSymbols.success} ${CONFIG_MESSAGES.savedSuccess}`,
      handler: async ({ args, deps: fd, setExitCode }) => {
        const key = args[configSet.arguments.key.name] as TSystemConfigKey;
        const value = args[configSet.arguments.value.name] as string;

        try {
          if (key === "apiKey") {
            const spinner = fd.createSpinner(CONFIG_MESSAGES.verifyingApiKey).start();
            try {
              await deps.verifyApiKey(value);
              spinner.succeed(CONFIG_MESSAGES.verifiedApiKey);
            } catch (error) {
              spinner.fail(CONFIG_MESSAGES.failedVerifyApiKey);
              throw error;
            }
          }

          await deps.setValue(key, value);
          return { success: true, key };
        } catch (error) {
          const fallbackPath = deps.resolveConfigPath(key);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          fd.error(
            `${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`
          );
          fd.error(
            `${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`
          );
          setExitCode(1);
          return undefined;
        }
      },
    },
    factoryDeps
  );
};
