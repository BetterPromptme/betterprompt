import logSymbols from "log-symbols";

import { OUTPUTS_COMMAND, OUTPUTS_MESSAGES } from "../../constants";
import { createParentCommandFromSpec } from "../../services/command-factory/service";
import {
  buildOutputsListQuery,
  createDefaultOutputsCommandDependencies,
  fetchOutputRun,
} from "../../services/outputs/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type {
  TOutputsCommandDependencies,
  TOutputsCommandOptions,
} from "../../types/outputs";
import { createOutputsGetSubcommand } from "./get/command";
import { formatRunOutputText } from "./get/command";
import { createOutputsListSubcommand } from "./list/command";

export const createOutputsCommand = (
  deps: TOutputsCommandDependencies = createDefaultOutputsCommandDependencies(),
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createParentCommandFromSpec<TOutputsCommandOptions>(
    {
      name: OUTPUTS_COMMAND.name,
      description: OUTPUTS_COMMAND.description,
      flags: OUTPUTS_COMMAND.flags,
      arguments: [
        {
          name: OUTPUTS_COMMAND.arguments.runId.name,
          description: OUTPUTS_COMMAND.arguments.runId.description,
        },
      ],
      spinnerMessage: "Fetching output run...",
      errorPrefix: `${logSymbols.error} ${OUTPUTS_MESSAGES.failedPrefix}`,
      handler: async ({ args, opts, ctx }) => {
        const runId = args[OUTPUTS_COMMAND.arguments.runId.name] as string;
        return fetchOutputRun(deps, runId, opts, ctx);
      },
      formatText: formatRunOutputText,
      subcommands: [
        createOutputsGetSubcommand(deps, factoryDeps),
        createOutputsListSubcommand(deps, factoryDeps),
      ],
    },
    factoryDeps
  );

export { buildOutputsListQuery };

export const outputsCommand = createOutputsCommand();
