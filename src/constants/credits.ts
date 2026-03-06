import { SHARED_FLAGS } from "./shared-flags";

export const CREDITS_COMMAND = {
  name: "credits",
  description: "Show the authenticated BetterPrompt credits balance",
  flags: {
    json: SHARED_FLAGS.json,
  },
} as const;

export const CREDITS_MESSAGES = {
  failedPrefix: "Credits command failed:",
  unknownError: "Unknown error",
} as const;
