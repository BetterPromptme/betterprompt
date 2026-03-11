import { Command } from "commander";
import { OUTPUTS_COMMAND } from "../../../constants";
import { executeOutputsGet } from "../../../services/outputs/service";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TOutputsCommandDependencies, TOutputsCommandOptions } from "../../../types/outputs";

export const createOutputsGetSubcommand = (
  deps: TOutputsCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const outputsGet = OUTPUTS_COMMAND.subcommands.get;

  return createCommandFromSpec<TOutputsCommandOptions>(
    {
      name: outputsGet.name,
      description: outputsGet.description,
      arguments: [
        {
          name: outputsGet.arguments.runId.name,
          description: outputsGet.arguments.runId.description,
        },
      ],
      flags: outputsGet.flags,
      customAction: (cmd, _factoryDeps) => {
        cmd.action(async (runId: string, opts: TOutputsCommandOptions, command: Command) => {
          const rootRemote = command.parent?.opts<{ remote?: boolean }>().remote === true;

          await executeOutputsGet(
            deps,
            runId,
            {
              ...opts,
              remote: opts.remote === true || rootRemote,
            },
            command
          );
        });
      },
    },
    factoryDeps
  );
};
