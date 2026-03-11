import { OUTPUTS_COMMAND } from "../../constants";
import {
  buildOutputsListQuery,
  createDefaultOutputsCommandDependencies,
  executeOutputsGet,
} from "../../services/outputs/service";
import { createParentCommandFromSpec } from "../../services/command-factory/service";
import { createOutputsGetSubcommand } from "./get/command";
import { createOutputsListSubcommand } from "./list/command";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TOutputsCommandDependencies, TOutputsCommandOptions } from "../../types/outputs";

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
      handler: async ({ args, opts, command }) => {
        const runId = args[OUTPUTS_COMMAND.arguments.runId.name] as string;
        await executeOutputsGet(deps, runId, opts, command);
        return undefined;
      },
      subcommands: [
        createOutputsGetSubcommand(deps),
        createOutputsListSubcommand(deps),
      ],
    },
    factoryDeps
  );

export { buildOutputsListQuery };

export const outputsCommand = createOutputsCommand();
