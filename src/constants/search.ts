export const SKILL_TYPES = ["image", "video", "text"] as const;

export const SEARCH_COMMAND = {
  name: "search",
  description: "Search BetterPrompt skills",
  queryDescription: "Search query (minimum 3 characters)",
} as const;

export const SEARCH_CONFIG = {
  minQueryLength: 3,
} as const;

export const SEARCH_MESSAGES = {
  helpText: `
Examples:
  $ betterprompt search react
  $ betterprompt search "productivity prompts"
`,
  invalidQueryLengthError: (minLength: number) =>
    `Search query must be at least ${minLength} characters.`,
  failedPrefix: "Search command failed:",
} as const;
