import chalk from "chalk";
import packageJson from "../../package.json";

export const CLI_META = {
  name: "betterprompt",
  description: "BetterPrompt CLI Tools",
  version: packageJson.version,
} as const;

export const CLI_MESSAGES = {
  globalHelpText: [
    "",
    chalk.bold.cyan("Quick Start:"),
    `  ${chalk.cyan("$")} betterprompt config get apiBaseUrl`,
    "",
    chalk.bold.cyan("Examples:"),
    `  ${chalk.cyan("$")} betterprompt --help`,
    `  ${chalk.cyan("$")} betterprompt config --help`,
    "",
  ].join("\n"),
} as const;
