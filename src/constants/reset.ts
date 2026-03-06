import { SHARED_FLAGS } from "./shared-flags";

export const RESET_COMMAND = {
  name: "reset",
  description: "Reset BetterPrompt CLI local data",
  flags: {
    json: SHARED_FLAGS.json,
  },
} as const;

export const RESET_MESSAGES = {
  confirmMessage: "This will remove ~/.betterprompt directory. Continue?",
  success: "Reset complete. Removed ~/.betterprompt",
  cancelled: "Reset cancelled.",
  failedPrefix: "Reset command failed:",
} as const;
