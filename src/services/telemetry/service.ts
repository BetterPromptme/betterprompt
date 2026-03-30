import crypto from "node:crypto";

import { CLI_HOSTS, CLI_META } from "../../constants/cli";
import {
  TELEMETRY_CONFIG,
  TELEMETRY_WHITELIST,
} from "../../constants/telemetry";
import type {
  TTelemetryDependencies,
  TTelemetryEvent,
} from "../../types/telemetry.d.ts";
import { getLoadedSystemConfig, loadOrInitConfig } from "../config/service";

let sessionId: string | undefined;

const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = crypto
      .randomBytes(TELEMETRY_CONFIG.sessionIdLength / 2)
      .toString("hex");
  }
  return sessionId;
};

const CI_ENV_VARS = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "JENKINS_URL",
  "BUILDKITE",
  "TRAVIS",
];

const defaultDeps: TTelemetryDependencies = {
  getConfig: () => loadOrInitConfig(),
  getEnv: (key: string) => process.env[key],
  fetch: globalThis.fetch,
  getBaseUrl: () => CLI_HOSTS.api,
  getCliVersion: () => CLI_META.version,
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  isCI: () => CI_ENV_VARS.some((v) => process.env[v]),
};

export const isEnabled = (
  deps: Pick<TTelemetryDependencies, "getEnv"> = defaultDeps
): boolean => {
  const disableTelemetry = deps.getEnv(
    TELEMETRY_CONFIG.envVars.disableTelemetry
  );
  if (disableTelemetry === "1") return false;

  const doNotTrack = deps.getEnv(TELEMETRY_CONFIG.envVars.doNotTrack);
  if (doNotTrack === "1") return false;

  const config = getLoadedSystemConfig();
  if (config) {
    const telemetry = config.telemetry;
    if (telemetry === false) return false;
    if (
      typeof telemetry === "object" &&
      telemetry !== null &&
      telemetry.enabled === false
    ) {
      return false;
    }
  }

  return true;
};

export const isCommandEnabled = (
  command: string,
  deps: Pick<TTelemetryDependencies, "getEnv"> = defaultDeps
): boolean => {
  if (!isEnabled(deps)) return false;

  const config = getLoadedSystemConfig();
  if (
    config &&
    typeof config.telemetry === "object" &&
    config.telemetry !== null
  ) {
    const { commands } = config.telemetry;
    if (commands && !commands.includes(command)) return false;
  }

  return true;
};

export const buildMetadata = (
  command: string,
  rawData: Record<string, unknown>,
  startedAt: number,
  deps: Pick<
    TTelemetryDependencies,
    "getPlatform" | "getArch" | "isCI"
  > = defaultDeps
): Record<string, unknown> => {
  const allowedKeys = TELEMETRY_WHITELIST[command] ?? [];
  const filtered: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (key in rawData && rawData[key] !== undefined) {
      if (key === "query" && typeof rawData[key] === "string") {
        filtered[key] = (rawData[key] as string).slice(
          0,
          TELEMETRY_CONFIG.maxQueryLength
        );
      } else {
        filtered[key] = rawData[key];
      }
    }
  }

  if (!("success" in filtered) && allowedKeys.includes("success")) {
    filtered.success = true;
  }

  if (allowedKeys.includes("durationMs")) {
    filtered.durationMs = Math.round(performance.now() - startedAt);
  }

  filtered.os = deps.getPlatform();
  filtered.arch = deps.getArch();
  filtered.isCi = deps.isCI();

  return filtered;
};

export const extractErrorData = (
  error: unknown
): Record<string, unknown> | undefined => {
  if (
    error &&
    typeof error === "object" &&
    "details" in error &&
    error.details &&
    typeof error.details === "object" &&
    "data" in error.details &&
    error.details.data !== undefined
  ) {
    return error.details.data as Record<string, unknown>;
  }
  return undefined;
};

export const track = (
  event: TTelemetryEvent,
  deps: TTelemetryDependencies = defaultDeps
): void => {
  if (!isCommandEnabled(event.command, deps)) return;

  const metadata = buildMetadata(
    event.command,
    event.metadata ?? {},
    event.startedAt,
    deps
  );

  const params = new URLSearchParams();
  params.set("e", event.command);
  params.set("v", deps.getCliVersion());
  params.set("sid", getSessionId());
  params.set("m", JSON.stringify(metadata));

  const url = `${deps.getBaseUrl()}${TELEMETRY_CONFIG.endpoint}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TELEMETRY_CONFIG.timeoutMs
  );

  deps
    .fetch(url, { signal: controller.signal })
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
};

export const resetTelemetryForTests = (): void => {
  sessionId = undefined;
};
