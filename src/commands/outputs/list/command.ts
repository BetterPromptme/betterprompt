import logSymbols from "log-symbols";

import {
  OUTPUTS_COMMAND,
  OUTPUTS_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import {
  fetchOutputsList,
  formatTable,
} from "../../../services/outputs/service";
import { track } from "../../../services/telemetry/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type {
  TOutputListRow,
  TOutputsCommandDependencies,
  TOutputsListCommandOptions,
} from "../../../types/outputs";

export const createOutputsListSubcommand = (
  deps: TOutputsCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const outputsList = OUTPUTS_COMMAND.subcommands.list;

  return createCommandFromSpec<TOutputsListCommandOptions>(
    {
      name: outputsList.name,
      description: outputsList.description,
      flags: outputsList.flags,
      spinnerMessage: "Loading outputs list...",
      errorPrefix: `${logSymbols.error} ${OUTPUTS_MESSAGES.failedPrefix}`,
      handler: async ({ opts, ctx, command }) => {
        const start = performance.now();
        const rootRemote =
          command.parent?.opts<{ remote?: boolean }>().remote === true;
        const result = await fetchOutputsList(
          deps,
          {
            ...opts,
            remote: opts.remote === true || rootRemote,
          },
          ctx
        );
        void track({
          command: TELEMETRY_COMMANDS["outputs:list"],
          startedAt: start,
          metadata: {
            resultCount: Array.isArray(result)
              ? (result as unknown[]).length
              : undefined,
          },
        });
        return result;
      },
      formatText: (result) => {
        const { rows } = result as { rows: TOutputListRow[] };
        if (rows.length === 0) {
          return `${logSymbols.warning} No outputs found.`;
        }
        return formatTable(rows);
      },
    },
    factoryDeps
  );
};
