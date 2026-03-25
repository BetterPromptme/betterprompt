import { CLI_HOSTS } from "./cli";

export const AUTH_API_KEY_URL = `${CLI_HOSTS.web}/api-keys`;

const AUTH_API_KEY_FLAG = {
  flag: "--api-key <key>",
  description: "API key for non-interactive auth",
} as const;

export const AUTH_COMMAND = {
  name: "auth",
  description: "Authenticate BetterPrompt CLI with your API key",
  flags: {
    apiKey: AUTH_API_KEY_FLAG,
  },
} as const;

export const AUTH_MESSAGES = {
  helpText: `
Examples:
  $ betterprompt login

Get an API key: ${AUTH_API_KEY_URL}
`,
  introTitle: "BetterPrompt Auth",
  getKeyText: `Get your API key at: ${AUTH_API_KEY_URL}`,
  passwordPrompt: "Enter your BetterPrompt API key",
  passwordPlaceholder: "bp_live_...",
  emptyKeyError: "API key cannot be empty.",
  verifyKeyText: "Verifying API key...",
  cancelMessage: "Authentication canceled.",
  successPrefix: "Authentication successful. Credentials saved to",
  failedPrefix: "Authentication failed:",
  failedNoChangesPrefix: "No changes were saved to",
  configMustBeObjectError: "Auth config must be a JSON object.",
  apiKeyVerifyFailedError: "API key verification failed.",
  apiKeyNotFoundError:
    "API key not found. Run `betterprompt login` to authenticate.",
} as const;

export const AUTH_STORAGE = {
  configDirName: ".betterprompt",
  fileName: "auth.json",
  directoryMode: 0o700,
  fileMode: 0o600,
  tempFilePrefix: "tmp",
} as const;
