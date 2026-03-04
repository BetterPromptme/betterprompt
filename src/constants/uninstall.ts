export const UNINSTALL_COMMAND = {
  name: "uninstall",
  description: "Uninstall BetterPrompt CLI and remove local data",
} as const;

export const UNINSTALL_MESSAGES = {
  confirmMessage:
    "This will remove ~/.betterprompt and uninstall the betterprompt package. Continue?",
  cancelled: "Uninstall cancelled.",
  failedPrefix: "Uninstall command failed:",
} as const;
