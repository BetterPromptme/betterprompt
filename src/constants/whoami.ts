import { SHARED_FLAGS } from "./flags";

export const WHOAMI_COMMAND = {
  name: "whoami",
  description: "Show the authenticated BetterPrompt identity",
  flags: {
    json: SHARED_FLAGS.json,
  },
} as const;

export const WHOAMI_MESSAGES = {
  failedPrefix: "Whoami command failed:",
  unknownError: "Unknown error",
} as const;
