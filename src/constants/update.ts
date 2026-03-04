export const UPDATE_COMMAND = {
  name: "update",
  description: "Check for CLI updates and install when available",
} as const;

export const UPDATE_MESSAGES = {
  failedPrefix: "Update command failed:",
} as const;
