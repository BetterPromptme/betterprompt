export const CREDITS_COMMAND = {
  name: "credits",
  description: "Show the authenticated BetterPrompt credits balance",
} as const;

export const CREDITS_MESSAGES = {
  failedPrefix: "Credits command failed:",
  unknownError: "Unknown error",
} as const;
