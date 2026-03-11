import { Command } from "commander";
import { OUTPUTS_COMMAND } from "../../../constants";
import { executeOutputsList } from "../../../services/outputs/service";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TOutputsCommandDependencies, TOutputsListCommandOptions } from "../../../types/outputs";

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
      customAction: (cmd, _factoryDeps) => {
        cmd.action(async (opts: TOutputsListCommandOptions, command: Command) => {
          const rootRemote = command.parent?.opts<{ remote?: boolean }>().remote === true;

          await executeOutputsList(
            deps,
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
