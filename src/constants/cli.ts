export const CLI_META = {
  name: "betterprompt",
  description: "BetterPrompt CLI Tools",
  version: "0.0.1",
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
