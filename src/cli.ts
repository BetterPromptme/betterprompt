import { Command } from "commander";
import { authCommand } from "./commands/auth/command";
import { configCommand } from "./commands/config/command";
import { creditsCommand } from "./commands/credits/command";
import { doctorCommand } from "./commands/doctor/command";
import { generateCommand } from "./commands/generate/command";
import { outputsCommand } from "./commands/outputs/command";
import { resetCommand } from "./commands/reset/command";
import { searchCommand } from "./commands/search/command";
import { skillCommand } from "./commands/skill/command";
import { updateCommand } from "./commands/update/command";
import { whoamiCommand } from "./commands/whoami/command";
import { CLI_MESSAGES, CLI_META } from "./constants";
import { bootstrapGlobalDirectory } from "./services/bootstrap/service";
import { installCtrlCHandler } from "./services/error-ux/service";
import { formatHelp } from "./cli/help";

export const createProgram = (): Command => {
  const program = new Command();

  program
    .name(CLI_META.name)
    .description(CLI_META.description)
    .version(CLI_META.version)
    .option(CLI_META.flags.project.flag, CLI_META.flags.project.description)
    .option(CLI_META.flags.global.flag, CLI_META.flags.global.description)
    .option(CLI_META.flags.dir.flag, CLI_META.flags.dir.description)
    .option(CLI_META.flags.registry.flag, CLI_META.flags.registry.description)
    .option(CLI_META.flags.json.flag, CLI_META.flags.json.description)
    .option(CLI_META.flags.quiet.flag, CLI_META.flags.quiet.description)
    .option(CLI_META.flags.verbose.flag, CLI_META.flags.verbose.description)
    .option(CLI_META.flags.noColor.flag, CLI_META.flags.noColor.description)
    .option(CLI_META.flags.yes.flag, CLI_META.flags.yes.description)
    .configureHelp({ formatHelp })
    .showHelpAfterError()
    .showSuggestionAfterError()
    .on("--help", () => {
      console.log(CLI_MESSAGES.globalHelpText);
    });

  program.addCommand(configCommand);
  program.addCommand(authCommand);
  program.addCommand(whoamiCommand);
  program.addCommand(creditsCommand);
  program.addCommand(doctorCommand);
  program.addCommand(generateCommand);
  program.addCommand(outputsCommand);
  program.addCommand(searchCommand);
  program.addCommand(skillCommand);
  program.addCommand(updateCommand);
  program.addCommand(resetCommand);

  return program;
};

export const runProgram = async (argv = process.argv): Promise<void> => {
  const uninstallCtrlCHandler = installCtrlCHandler({
    register: (signal, handler) => process.on(signal, handler),
    unregister: (signal, handler) => process.off(signal, handler),
    cleanup: () => {},
    setExitCode: (code) => {
      process.exitCode = code;
    },
    log: (message) => {
      console.error(message);
    },
  });

  try {
    await bootstrapGlobalDirectory();
    const program = createProgram();
    await program.parseAsync(argv);
  } finally {
    uninstallCtrlCHandler();
  }
};

if (import.meta.main) {
  await runProgram();
}
