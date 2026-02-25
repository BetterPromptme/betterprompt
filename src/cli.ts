import { Command } from "commander";
import { demoCommand } from "./commands/demo";

const globalHelpText = `
Quick Start:
  $ betterprompt demo
  $ betterprompt demo "hello world"
  $ betterprompt demo "hello world" --repeat 3

Global Examples:
  $ betterprompt --help
  $ betterprompt demo --help
`;

const program = new Command();

program
  .name("betterprompt")
  .description("BetterPrompt CLI Tools")
  .version("0.0.1")
  .showHelpAfterError()
  .showSuggestionAfterError()
  .on("--help", () => {
    console.log(globalHelpText);
  });

program.addCommand(demoCommand);

program.parse();
