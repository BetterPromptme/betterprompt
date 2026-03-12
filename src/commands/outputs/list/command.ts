import logSymbols from "log-symbols";
import { OUTPUTS_COMMAND, OUTPUTS_MESSAGES } from "../../../constants";
import { fetchOutputsList, formatTable } from "../../../services/outputs/service";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TOutputsCommandDependencies, TOutputsListCommandOptions, TOutputListRow } from "../../../types/outputs";

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
        const rootRemote = command.parent?.opts<{ remote?: boolean }>().remote === true;
        return fetchOutputsList(deps, {
          ...opts,
          remote: opts.remote === true || rootRemote,
        }, ctx);
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
