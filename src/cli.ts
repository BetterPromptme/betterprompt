import { authCommand } from "./commands/auth";
import { Command } from "commander";
import { configCommand } from "./commands/config";
import { creditsCommand } from "./commands/credits";
import { doctorCommand } from "./commands/doctor";
import { generateCommand } from "./commands/generate";
import { outputsCommand } from "./commands/outputs";
import { searchCommand } from "./commands/search";
import { skillCommand } from "./commands/skills";
import { whoamiCommand } from "./commands/whoami";
import { updateCommand } from "./commands/update";
import { uninstallCommand } from "./commands/uninstall";
import { CLI_MESSAGES, CLI_META } from "./constants";
import { loadOrInitConfig } from "./core/config";
import { installCtrlCHandler } from "./core/error-ux";
import { formatHelp } from "./core/help";

export const createProgram = (): Command => {
  const program = new Command();

  program
    .name(CLI_META.name)
    .description(CLI_META.description)
    .version(CLI_META.version)
    .option("--project", "Use project scope")
    .option("--global", "Use global scope")
    .option("--dir <path>", "Use an explicit working directory")
    .option("--registry <url>", "Override API registry endpoint")
    .option("--json", "Render output as JSON")
    .option("--quiet", "Reduce non-essential output")
    .option("--verbose", "Enable verbose output")
    .option("--no-color", "Disable ANSI colors")
    .option("--yes", "Answer yes to all confirmations")
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
  program.addCommand(uninstallCommand);

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
    await loadOrInitConfig();
    const program = createProgram();
    await program.parseAsync(argv);
  } finally {
    uninstallCtrlCHandler();
  }
};

if (import.meta.main) {
  await runProgram();
}
