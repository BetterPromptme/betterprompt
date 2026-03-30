import logSymbols from "log-symbols";

import {
  CONFIG_COMMAND,
  CONFIG_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type {
  TConfigCommandDependencies,
  TConfigSubcommandOpts,
  TSystemConfigKey,
} from "../types";
import { maskApiKey, parseConfigKey } from "../utils";

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
      errorPrefix: `${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix}`,
      telemetry: {
        command: TELEMETRY_COMMANDS["config:get"],
        getMetadata: (_r, _o, args) => ({ key: args.key }),
      },
      handler: async ({ args, ctx, deps: fd }) => {
        const key = args[configGet.arguments.key.name] as
          | TSystemConfigKey
          | undefined;

        if (!key) {
          const values = await deps.getAllValues();
          const masked = { ...values };
          if (typeof masked.apiKey === "string") {
            masked.apiKey = maskApiKey(masked.apiKey);
          }

          if (ctx.outputFormat === "json") {
            fd.printResult(masked, ctx);
            return undefined;
          }

          const entries = Object.entries(values).filter(
            ([, value]) => typeof value === "string" && value.trim()
          );

          if (!entries.length) {
            fd.printResult("No config values set.", ctx);
            return undefined;
          }

          for (const [entryKey, value] of entries) {
            const display =
              entryKey === "apiKey" ? maskApiKey(value as string) : value;
            fd.printResult(`${entryKey}=${display}`, ctx);
          }
          return undefined;
        }

        const value = await deps.getValue(key);
        if (typeof value !== "string" || !value.trim()) {
          throw new Error(CONFIG_MESSAGES.missingValueError(key));
        }
        const displayValue = key === "apiKey" ? maskApiKey(value) : value;

        if (ctx.outputFormat === "json") {
          fd.printResult({ key, value: displayValue }, ctx);
        } else {
          fd.printResult(`${logSymbols.info} ${displayValue}`, ctx);
        }
        return undefined;
      },
    },
    factoryDeps
  );
};
