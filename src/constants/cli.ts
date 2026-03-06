import chalk from "chalk";
import packageJson from "../../package.json";
import { SHARED_FLAGS } from "./flags";

export const CLI_META = {
  name: "betterprompt",
  description: "BetterPrompt CLI Tools",
  version: packageJson.version,
  flags: {
    project: {
      flag: "--project",
      description: "Use project scope",
    },
    global: {
      flag: "--global",
      description: "Use global scope",
    },
    dir: {
      flag: "--dir <path>",
      description: "Use an explicit working directory",
    },
    registry: {
      flag: "--registry <url>",
      description: "Override API registry endpoint",
    },
    json: SHARED_FLAGS.json,
    quiet: {
      flag: "--quiet",
      description: "Reduce non-essential output",
    },
    verbose: {
      flag: "--verbose",
      description: "Enable verbose output",
    },
    noColor: {
      flag: "--no-color",
      description: "Disable ANSI colors",
    },
    yes: {
      flag: "--yes",
      description: "Answer yes to all confirmations",
    },
  },
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
