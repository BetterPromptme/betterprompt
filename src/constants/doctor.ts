import { SHARED_FLAGS } from "./flags";

export const DOCTOR_COMMAND = {
  name: "doctor",
  description: "Run health checks for BetterPrompt environment",
  flags: {
    fix: {
      flag: "--fix",
      description: "Attempt to fix remediable problems",
    },
    json: SHARED_FLAGS.json,
  },
} as const;

export const DOCTOR_MESSAGES = {
  failedPrefix: "Doctor command failed:",
} as const;
