import { SHARED_FLAGS } from "./shared-flags";

export const UPDATE_COMMAND = {
  name: "update",
  description: "Check for CLI updates and install when available",
  flags: {
    json: SHARED_FLAGS.json,
  },
} as const;

export const UPDATE_MESSAGES = {
  failedPrefix: "Update command failed:",
} as const;
