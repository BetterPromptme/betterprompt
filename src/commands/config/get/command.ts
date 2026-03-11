import logSymbols from "log-symbols";
import { CONFIG_COMMAND, CONFIG_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { getCommandContext } from "../../../services/context/service";
import { maskApiKey, parseConfigKey } from "../utils";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TConfigCommandDependencies, TConfigSubcommandOpts, TSystemConfigKey } from "../types";

export const createConfigGetSubcommand = (
  deps: TConfigCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const configGet = CONFIG_COMMAND.subcommands.get;

  return createCommandFromSpec<TConfigSubcommandOpts>(
    {
      name: configGet.name,
      description: configGet.description,
      flags: configGet.flags,
      arguments: [
        {
          name: configGet.arguments.key.name,
          description: configGet.arguments.key.description,
          parse: parseConfigKey as (v: string) => unknown,
        },
      ],
      customAction: (cmd, _factoryDeps) => {
        cmd.usage("[options] [<key>]");
        cmd.action(
          async (
            key: TSystemConfigKey | undefined,
            _opts: TConfigSubcommandOpts,
            command
          ) => {
            try {
              const ctx = getCommandContext(command);

              if (!key) {
                const values = await deps.getAllValues();
                const entries = Object.entries(values).filter(
                  ([, value]) => typeof value === "string" && value.trim()
                );

                if (ctx.outputFormat === "json") {
                  const masked = { ...values };
                  if (typeof masked.apiKey === "string") {
                    masked.apiKey = maskApiKey(masked.apiKey);
                  }
                  deps.log(JSON.stringify(masked));
                  return;
                }

                if (!entries.length) {
                  deps.log("No config values set.");
                  return;
                }

                for (const [entryKey, value] of entries) {
                  const display =
                    entryKey === "apiKey" ? maskApiKey(value as string) : value;
                  deps.log(`${entryKey}=${display}`);
                }
                return;
              }

              const value = await deps.getValue(key);
              if (typeof value !== "string" || !value.trim()) {
                throw new Error(CONFIG_MESSAGES.missingValueError(key));
              }
              const displayValue = key === "apiKey" ? maskApiKey(value) : value;
              if (ctx.outputFormat === "json") {
                deps.log(JSON.stringify({ key, value: displayValue }));
              } else {
                deps.log(`${logSymbols.info} ${displayValue}`);
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
