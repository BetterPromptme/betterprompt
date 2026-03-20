import { afterEach, describe, expect, it, mock } from "bun:test";

import { TELEMETRY_CONFIG } from "../../constants";
import { CLI_HOSTS, CLI_META } from "../../constants/cli";
import type { TSystemConfig } from "../../types/config";
import type { TTelemetryDependencies } from "../../types/telemetry";
import { isEnabled, resetTelemetryForTests, track } from "./service";

type TMockFetch = ReturnType<
  typeof mock<(url: string, init?: RequestInit) => Promise<Response>>
>;

const createMockDeps = (
  overrides: Partial<TTelemetryDependencies> = {}
): TTelemetryDependencies & { mockFetch: TMockFetch } => {
  const mockFetch = mock<
    (url: string, init?: RequestInit) => Promise<Response>
  >(() => Promise.resolve(new Response(null, { status: 204 })));
  return {
    getConfig: () => Promise.resolve({ version: "0.1.0" } as TSystemConfig),
    getEnv: () => undefined,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    getBaseUrl: () => CLI_HOSTS.api,
    getCliVersion: () => CLI_META.version,
    getPlatform: () => "darwin",
    getArch: () => "arm64",
    isCI: () => false,
    mockFetch,
    ...overrides,
  };
};

const getCalledUrl = (mockFetch: TMockFetch, callIndex = 0): URL =>
  new URL(mockFetch.mock.calls[callIndex][0]);

afterEach(() => {
  resetTelemetryForTests();
  mock.restore();
});

describe("isEnabled", () => {
  it("should return true by default", () => {
    const deps = createMockDeps();
    expect(isEnabled(deps)).toBe(true);
  });

  it("should return false when DISABLE_TELEMETRY=1", () => {
    const deps = createMockDeps({
      getEnv: (key) =>
        key === TELEMETRY_CONFIG.envVars.disableTelemetry ? "1" : undefined,
    });
    expect(isEnabled(deps)).toBe(false);
  });

  it("should return false when DO_NOT_TRACK=1", () => {
    const deps = createMockDeps({
      getEnv: (key) =>
        key === TELEMETRY_CONFIG.envVars.doNotTrack ? "1" : undefined,
    });
    expect(isEnabled(deps)).toBe(false);
  });
});

describe("track", () => {
  it("should not call fetch when disabled by env", () => {
    const deps = createMockDeps({
      getEnv: (key) =>
        key === TELEMETRY_CONFIG.envVars.disableTelemetry ? "1" : undefined,
    });

    track({ event: "generate" }, deps);

    expect(deps.mockFetch).not.toHaveBeenCalled();
  });

  it("should call fetch with correct params for generate event", () => {
    const deps = createMockDeps();

    track(
      {
        event: "generate",
        skillSlug: "test-skill",
        model: "gpt-4",
        success: true,
      },
      deps
    );

    expect(deps.mockFetch).toHaveBeenCalledTimes(1);
    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.get("e")).toBe("generate");
    expect(url.searchParams.get("sk")).toBe("test-skill");
    expect(url.searchParams.get("m")).toBe("gpt-4");
    expect(url.searchParams.get("s")).toBe("1");
    expect(url.searchParams.get("v")).toBe(CLI_META.version);
    expect(url.searchParams.get("os")).toBe("darwin");
    expect(url.searchParams.get("arch")).toBe("arm64");
    expect(url.searchParams.get("sid")).toBeTruthy();
  });

  it("should call fetch with correct params for search event", () => {
    const deps = createMockDeps();

    track({ event: "search", query: "image generator", resultCount: 5 }, deps);

    expect(deps.mockFetch).toHaveBeenCalledTimes(1);
    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.get("e")).toBe("search");
    expect(url.searchParams.get("q")).toBe("image generator");
    expect(url.searchParams.get("rc")).toBe("5");
  });

  it("should set ci=1 when in CI environment", () => {
    const deps = createMockDeps({ isCI: () => true });

    track({ event: "generate" }, deps);

    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.get("ci")).toBe("1");
  });

  it("should not set ci param when not in CI", () => {
    const deps = createMockDeps({ isCI: () => false });

    track({ event: "generate" }, deps);

    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.has("ci")).toBe(false);
  });

  it("should swallow fetch errors silently", () => {
    const errorFetch = mock<
      (url: string, init?: RequestInit) => Promise<Response>
    >(() => Promise.reject(new Error("network error")));
    const deps = createMockDeps({
      fetch: errorFetch as unknown as typeof globalThis.fetch,
    });

    expect(() => track({ event: "generate" }, deps)).not.toThrow();
  });

  it("should truncate query to maxQueryLength", () => {
    const deps = createMockDeps();
    const longQuery = "a".repeat(300);

    track({ event: "search", query: longQuery }, deps);

    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.get("q")?.length).toBe(
      TELEMETRY_CONFIG.maxQueryLength
    );
  });

  it("should set success=0 when success is false", () => {
    const deps = createMockDeps();

    track({ event: "generate", success: false }, deps);

    const url = getCalledUrl(deps.mockFetch);
    expect(url.searchParams.get("s")).toBe("0");
  });

  it("should use consistent session ID across calls", () => {
    const deps = createMockDeps();

    track({ event: "generate" }, deps);
    track({ event: "generate" }, deps);

    const url1 = getCalledUrl(deps.mockFetch, 0);
    const url2 = getCalledUrl(deps.mockFetch, 1);
    expect(url1.searchParams.get("sid")).toBe(url2.searchParams.get("sid"));
  });
});
