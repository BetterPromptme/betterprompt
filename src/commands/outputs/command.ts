import { Command } from "commander";
import { OUTPUTS_COMMAND } from "../../constants";
import {
  buildOutputsListQuery,
  createDefaultOutputsCommandDependencies,
  executeOutputsGet,
} from "../../services/outputs/service";
import { createOutputsGetSubcommand } from "./get/command";
import { createOutputsListSubcommand } from "./list/command";
import type { TOutputsCommandDependencies, TOutputsCommandOptions } from "../../types/outputs";

export const createOutputsCommand = (
  deps: TOutputsCommandDependencies = createDefaultOutputsCommandDependencies()
): Command => {
  const command = new Command(OUTPUTS_COMMAND.name)
    .description(OUTPUTS_COMMAND.description)
    .usage("[options] <run-id>")
    .argument(
      OUTPUTS_COMMAND.arguments.runId.name,
      OUTPUTS_COMMAND.arguments.runId.description
    )
    .option(OUTPUTS_COMMAND.flags.sync.flag, OUTPUTS_COMMAND.flags.sync.description)
    .option(OUTPUTS_COMMAND.flags.remote.flag, OUTPUTS_COMMAND.flags.remote.description)
    .option(OUTPUTS_COMMAND.flags.json.flag, OUTPUTS_COMMAND.flags.json.description)
    .action((runId: string, opts: TOutputsCommandOptions, rootCommand: Command) =>
      executeOutputsGet(deps, runId, opts, rootCommand)
    );

  command.addCommand(createOutputsGetSubcommand(deps));
  command.addCommand(createOutputsListSubcommand(deps));

  return command;
};

export { buildOutputsListQuery };

export const outputsCommand = createOutputsCommand();
