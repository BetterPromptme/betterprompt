import { SHARED_FLAGS } from "./shared-flags";

export const SKILL_TYPES = ["image", "video", "text"] as const;

export const SEARCH_COMMAND = {
  name: "search",
  description: "Search BetterPrompt skills",
  arguments: {
    query: {
      name: "<query>",
      description: "Search query (minimum 3 characters)",
    },
  },
  flags: {
    type: {
      flag: "--type <type>",
      description: `Filter by skill type (${SKILL_TYPES.join(", ")})`,
    },
    author: {
      flag: "--author <author>",
      description: "Filter by author",
    },
    json: SHARED_FLAGS.json,
  },
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
