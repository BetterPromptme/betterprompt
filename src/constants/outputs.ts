import { SHARED_FLAGS } from "./shared-flags";

export const OUTPUTS_COMMAND = {
  name: "outputs",
  description: "Fetch outputs from a run",
  arguments: {
    runId: {
      name: "<run-id>",
      description: "Run ID to fetch",
    },
  },
  flags: {
    sync: SHARED_FLAGS.sync,
    remote: SHARED_FLAGS.remote,
    json: SHARED_FLAGS.json,
  },
  subcommands: {
    get: {
      name: "get",
      description: "Fetch outputs from a run",
      arguments: {
        runId: {
          name: "<run-id>",
          description: "Run ID to fetch",
        },
      },
      flags: {
        sync: SHARED_FLAGS.sync,
        remote: SHARED_FLAGS.remote,
        json: SHARED_FLAGS.json,
      },
    },
    list: {
      name: "list",
      description: "List output runs",
      flags: {
        remote: SHARED_FLAGS.remote,
        status: {
          flag: "--status <status>",
          description: "Filter by status (queued|running|succeeded|failed)",
        },
        limit: {
          flag: "--limit <n>",
          description: "Limit the number of rows",
        },
        since: {
          flag: "--since <date>",
          description: "Only include rows created at or after this date",
        },
        json: SHARED_FLAGS.json,
      },
    },
  },
} as const;

export const OUTPUTS_MESSAGES = {
  failedPrefix: "Outputs command failed:",
  remoteHint: "Hint: retry with --remote to fetch from API.",
  emptyMessagePrefix: "No outputs found for run",
  runStatusPrefix: "Run status:",
} as const;
