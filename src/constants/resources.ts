import { SHARED_FLAGS } from "./shared-flags";

export const RESOURCES_COMMAND = {
  name: "resources",
  description: "Show available BetterPrompt models and resources",
  flags: {
    remote: SHARED_FLAGS.remote,
    sync: SHARED_FLAGS.sync,
    modelsOnly: {
      flag: "--models-only",
      description: "Output only the models list",
    },
    json: SHARED_FLAGS.json,
  },
} as const;

export const RESOURCES_STORAGE = {
  fileName: "resources.json",
} as const;

export const RESOURCES_ACTION_HEADER = {
  key: "action-require",
  updateResources: "update-resources",
} as const;

export const RESOURCES_MESSAGES = {
  failedPrefix: "Resources command failed:",
  unknownError: "Unknown error",
  fetchingRemote: "Fetching resources from remote...",
  readingLocal: "Reading local resources cache...",
  noLocalCache: "No local cache found, fetching from remote...",
  autoSyncing: "Syncing resources...",
  remoteSyncMutuallyExclusive: "--remote and --sync are mutually exclusive.",
} as const;
