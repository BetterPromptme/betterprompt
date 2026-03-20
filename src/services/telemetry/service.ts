import crypto from "node:crypto";
import os from "node:os";

import { TELEMETRY_CONFIG } from "../../constants";
import { CLI_HOSTS, CLI_META } from "../../constants/cli";
import type {
  TTelemetryDependencies,
  TTelemetryEvent,
} from "../../types/telemetry";
import { getLoadedSystemConfig, loadOrInitConfig } from "../config/service";

const CI_ENV_VARS = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "JENKINS_URL",
  "BUILDKITE",
  "TRAVIS",
];

let sessionId: string | undefined;

const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = crypto
      .randomBytes(TELEMETRY_CONFIG.sessionIdLength / 2)
      .toString("hex");
  }
  return sessionId;
};

const detectCI = (getEnv: (key: string) => string | undefined): boolean =>
  CI_ENV_VARS.some((v) => getEnv(v) !== undefined && getEnv(v) !== "");

const defaultDeps: TTelemetryDependencies = {
  getConfig: () => loadOrInitConfig(),
  getEnv: (key) => process.env[key],
  fetch: globalThis.fetch,
  getBaseUrl: () => CLI_HOSTS.api,
  getCliVersion: () => CLI_META.version,
  getPlatform: () => os.platform(),
  getArch: () => os.arch(),
  isCI: () => detectCI((key) => process.env[key]),
};

export const isEnabled = (
  deps: Pick<TTelemetryDependencies, "getEnv"> = defaultDeps
): boolean => {
  if (
    deps.getEnv(TELEMETRY_CONFIG.envVars.disableTelemetry) === "1" ||
    deps.getEnv(TELEMETRY_CONFIG.envVars.doNotTrack) === "1"
  ) {
    return false;
  }

  const config = getLoadedSystemConfig();
  if (config?.telemetry === false) {
    return false;
  }

  return true;
};

export const track = (
  event: TTelemetryEvent,
  deps: TTelemetryDependencies = defaultDeps
): void => {
  if (!isEnabled(deps)) {
    return;
  }

  const params = new URLSearchParams();
  params.set("e", event.event);
  params.set("v", deps.getCliVersion());
  params.set("os", deps.getPlatform());
  params.set("arch", deps.getArch());
  params.set("sid", getSessionId());

  if (deps.isCI()) {
    params.set("ci", "1");
  }

  if (event.skillSlug !== undefined) {
    params.set("sk", event.skillSlug);
  }
  if (event.model !== undefined) {
    params.set("m", event.model);
  }
  if (event.success !== undefined) {
    params.set("s", event.success ? "1" : "0");
  }
  if (event.query !== undefined) {
    params.set("q", event.query.slice(0, TELEMETRY_CONFIG.maxQueryLength));
  }
  if (event.resultCount !== undefined) {
    params.set("rc", String(event.resultCount));
  }

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
