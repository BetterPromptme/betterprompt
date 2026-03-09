import { Command } from "commander";
import { OUTPUTS_COMMAND } from "../../../constants";
import { executeOutputsGet } from "../../../services/outputs/service";
import type { TOutputsCommandDependencies, TOutputsCommandOptions } from "../../../types/outputs";

export const createOutputsGetSubcommand = (
  deps: TOutputsCommandDependencies
): Command => {
  const outputsGet = OUTPUTS_COMMAND.subcommands.get;

  return new Command(outputsGet.name)
    .description(outputsGet.description)
    .argument(outputsGet.arguments.runId.name, outputsGet.arguments.runId.description)
    .option(outputsGet.flags.sync.flag, outputsGet.flags.sync.description)
    .option(outputsGet.flags.remote.flag, outputsGet.flags.remote.description)
    .option(outputsGet.flags.json.flag, outputsGet.flags.json.description)
    .action(async (runId: string, opts: TOutputsCommandOptions, command: Command) => {
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
};
