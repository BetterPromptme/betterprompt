import { Command } from "commander";
import { configCommand } from "./commands/config";
import { searchCommand } from "./commands/search";
import { CLI_MESSAGES, CLI_META } from "./constants";
import { loadOrInitConfig } from "./core/config";

export const createProgram = (): Command => {
  const program = new Command();

  program
    .name(CLI_META.name)
    .description(CLI_META.description)
    .version(CLI_META.version)
    .showHelpAfterError()
    .showSuggestionAfterError()
    .on("--help", () => {
      console.log(CLI_MESSAGES.globalHelpText);
    });

  program.addCommand(configCommand);
  program.addCommand(searchCommand);

  return program;
};

export const runProgram = async (argv = process.argv): Promise<void> => {
  await loadOrInitConfig();
  const program = createProgram();
  await program.parseAsync(argv);
};

if (import.meta.main) {
  await runProgram();
}
