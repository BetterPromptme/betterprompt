import packageJson from "../../package.json";

export const CLI_META = {
  name: "betterprompt",
  description: "BetterPrompt CLI Tools",
  version: packageJson.version,
} as const;

export const CLI_MESSAGES = {
  globalHelpText: `
Quick Start:
  $ betterprompt config get apiBaseUrl

Global Examples:
  $ betterprompt --help
  $ betterprompt config --help
`,
} as const;
