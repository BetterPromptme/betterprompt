export const RESET_COMMAND = {
  name: "reset",
  description: "Reset BetterPrompt CLI local data",
} as const;

export const RESET_MESSAGES = {
  confirmMessage: "This will remove ~/.betterprompt directory. Continue?",
  success: "Reset complete. Removed ~/.betterprompt",
  cancelled: "Reset cancelled.",
  failedPrefix: "Reset command failed:",
} as const;
