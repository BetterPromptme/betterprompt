import logSymbols from "log-symbols";
import ora from "ora";
import { CONFIG_COMMAND, CONFIG_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { getCommandContext } from "../../../services/context/service";
import { parseConfigKey } from "../utils";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TConfigCommandDependencies, TSystemConfigKey } from "../types";

type TConfigSetOpts = { json?: boolean };

export const createConfigSetSubcommand = (
  deps: TConfigCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const configSet = CONFIG_COMMAND.subcommands.set;

  return createCommandFromSpec<TConfigSetOpts>(
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
      customAction: (cmd, _factoryDeps) => {
        cmd.action(
          async (
            key: TSystemConfigKey,
            value: string,
            _opts: TConfigSetOpts,
            command
          ) => {
            try {
              const ctx = getCommandContext(command);

              if (key === "apiKey") {
                const spinner = ora(CONFIG_MESSAGES.verifyingApiKey).start();
                try {
                  await deps.verifyApiKey(value);
                  spinner.succeed(CONFIG_MESSAGES.verifiedApiKey);
                } catch (error) {
                  spinner.fail(CONFIG_MESSAGES.failedVerifyApiKey);
                  throw error;
                }
              }

              await deps.setValue(key, value);
              if (ctx.outputFormat === "json") {
                deps.log(JSON.stringify({ success: true, key }));
              } else {
                deps.log(
                  `${logSymbols.success} ${CONFIG_MESSAGES.savedSuccess}`
                );
              }
            } catch (error) {
              const fallbackPath = deps.resolveConfigPath(key);
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              deps.error(
                `${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`
              );
              deps.error(
                `${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`
              );
              deps.setExitCode(1);
            }
          }
        );
      },
    },
    factoryDeps
  );
};
