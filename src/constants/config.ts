import { CLI_META } from "./cli";
import { AUTH_API_KEY_URL } from "./auth";
import { SHARED_FLAGS } from "./shared-flags";

export const API_CONFIG = {
  baseUrl: "https://api.betterprompt.me/v1",
  timeoutMs: 5 * 60 * 1000, // 5 min
  authHeader: "authorization",
  authScheme: "Bearer",
  defaultHeaders: {
    Accept: "application/json",
  },
} as const;

export const SYSTEM_CONFIG = {
  version: CLI_META.version,
  apiBaseUrl: API_CONFIG.baseUrl,
} as const;

export const SYSTEM_STORAGE = {
  configDirName: ".betterprompt",
  fileName: "config.json",
  directoryMode: 0o700,
  fileMode: 0o600,
  tempFilePrefix: "tmp",
} as const;

export const SYSTEM_MESSAGES = {
  configMustBeObjectError: "System config must be a JSON object.",
  invalidApiBaseUrlError: "apiBaseUrl cannot be empty.",
};

export const CONFIG_COMMAND = {
  name: "config",
  description: "Read and update BetterPrompt config values",
  flags: {
    json: SHARED_FLAGS.json,
  },
  subcommands: {
    get: {
      name: "get",
      description: "Get a value from config.json",
      arguments: {
        key: {
          name: "[key]",
          description: "Config key (apiKey | apiBaseUrl)",
        },
      },
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
    set: {
      name: "set",
      description: "Set a value in config.json",
      arguments: {
        key: {
          name: "<key>",
          description: "Config key (apiKey | apiBaseUrl)",
        },
        value: {
          name: "<value>",
          description: "Value to store",
        },
      },
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
    unset: {
      name: "unset",
      description: "Unset a value from config.json",
      arguments: {
        key: {
          name: "<key>",
          description: "Config key (apiKey | apiBaseUrl)",
        },
      },
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
  },
} as const;

export const CONFIG_MESSAGES = {
  helpText: `
Get an API key: ${AUTH_API_KEY_URL}

Examples:
  $ betterprompt config get apiKey
  $ betterprompt config set apiKey bp_live_123
  $ betterprompt config get apiBaseUrl
  $ betterprompt config set apiBaseUrl https://betterprompt.me/api
`,
  invalidKeyError: (key: string) =>
    `Invalid config key "${key}". Supported keys: apiKey, apiBaseUrl.`,
  missingValueError: (key: string) => `${key} is not set in config.json.`,
  savedSuccess: "Config updated successfully.",
  failedPrefix: "Config command failed:",
  failedNoChangesPrefix: "No changes were saved to",
  verifyingApiKey: "Verifying API key...",
  verifiedApiKey: "API key verified.",
  failedVerifyApiKey: "API key verification failed.",
} as const;
