import logSymbols from "log-symbols";

import {
  CONFIG_COMMAND,
  CONFIG_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TConfigCommandDependencies, TSystemConfigKey } from "../types";
import { parseConfigKey } from "../utils";

export const createConfigUnsetSubcommand = (
  deps: TConfigCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const configUnset = CONFIG_COMMAND.subcommands.unset;

  return createCommandFromSpec<Record<string, unknown>>(
    {
      name: configUnset.name,
      description: configUnset.description,
      flags: configUnset.flags,
      arguments: [
        {
          name: configUnset.arguments.key.name,
          description: configUnset.arguments.key.description,
          parse: parseConfigKey as (v: string) => unknown,
        },
      ],
      formatText: () => `${logSymbols.success} ${CONFIG_MESSAGES.savedSuccess}`,
      telemetry: {
        command: TELEMETRY_COMMANDS["config:unset"],
        getMetadata: (_r, _o, args) => ({ key: args.key }),
      },
      handler: async ({ args }) => {
        const key = args[configUnset.arguments.key.name] as TSystemConfigKey;
        await deps.unsetValue(key);
        return { success: true, key };
      },
    },
    factoryDeps
  );
};
