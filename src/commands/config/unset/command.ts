import logSymbols from "log-symbols";

import {
  CONFIG_COMMAND,
  CONFIG_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { track } from "../../../services/telemetry/service";
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
      handler: async ({ args, setExitCode, deps: fd }) => {
        const start = performance.now();
        const key = args[configUnset.arguments.key.name] as TSystemConfigKey;
        try {
          await deps.unsetValue(key);
          void track({
            command: TELEMETRY_COMMANDS["config:unset"],
            startedAt: start,
            metadata: { key: args.key },
          });
          return { success: true, key };
        } catch (error) {
          const fallbackPath = deps.resolveConfigPath(key);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          fd.error(
            `${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`
          );
          fd.error(`${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
          setExitCode(1);
          return undefined;
        }
      },
    },
    factoryDeps
  );
};
