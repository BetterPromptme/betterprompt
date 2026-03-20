export const TELEMETRY_CONFIG = {
  endpoint: "/t/cli",
  sessionIdLength: 12,
  maxQueryLength: 200,
  timeoutMs: 3000,
  envVars: {
    disableTelemetry: "DISABLE_TELEMETRY",
    doNotTrack: "DO_NOT_TRACK",
  },
} as const;

export const TELEMETRY_EVENTS = {
  generate: "generate",
  skillInstall: "skill_install",
  skillUninstall: "skill_uninstall",
  skillSearch: "skill_search",
  search: "search",
} as const;
