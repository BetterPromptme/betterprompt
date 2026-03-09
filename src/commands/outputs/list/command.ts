import { Command } from "commander";
import { OUTPUTS_COMMAND } from "../../../constants";
import { executeOutputsList } from "../../../services/outputs/service";
import type { TOutputsCommandDependencies, TOutputsListCommandOptions } from "../../../types/outputs";

export const createOutputsListSubcommand = (
  deps: TOutputsCommandDependencies
): Command => {
  const outputsList = OUTPUTS_COMMAND.subcommands.list;

  return new Command(outputsList.name)
    .description(outputsList.description)
    .option(outputsList.flags.remote.flag, outputsList.flags.remote.description)
    .option(outputsList.flags.status.flag, outputsList.flags.status.description)
    .option(outputsList.flags.limit.flag, outputsList.flags.limit.description)
    .option(outputsList.flags.since.flag, outputsList.flags.since.description)
    .option(outputsList.flags.json.flag, outputsList.flags.json.description)
    .action(async (opts: TOutputsListCommandOptions, command: Command) => {
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
};
