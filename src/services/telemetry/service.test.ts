import { afterEach, describe, expect, it, mock } from "bun:test";

import type { TSystemConfig } from "../../types/config.d.ts";
import type { TTelemetryDependencies } from "../../types/telemetry.d.ts";
import {
  buildMetadata,
  extractErrorData,
  isCommandEnabled,
  isEnabled,
  resetTelemetryForTests,
  track,
} from "./service";

type TMockFetch = ReturnType<typeof mock> & typeof globalThis.fetch;

const createMockDeps = (
  overrides: Partial<TTelemetryDependencies> = {}
): TTelemetryDependencies & { mockFetch: TMockFetch } => {
  const mockFetch = mock(() =>
    Promise.resolve(new Response(null, { status: 204 }))
  ) as TMockFetch;

  return {
    getConfig: async () => ({ version: "1.0.0" }),
    getEnv: () => undefined,
    fetch: mockFetch,
    getBaseUrl: () => "https://api.betterprompt.me",
    getCliVersion: () => "0.2.0",
    getPlatform: () => "darwin",
    getArch: () => "arm64",
    isCI: () => false,
    mockFetch,
    ...overrides,
  };
};

const getCalledUrl = (mockFetch: TMockFetch): URL =>
  new URL(mockFetch.mock.calls[0][0] as string);

const getCalledMetadata = (mockFetch: TMockFetch): Record<string, unknown> => {
  const url = getCalledUrl(mockFetch);
  return JSON.parse(url.searchParams.get("m") ?? "{}");
};

describe("telemetry service", () => {
  afterEach(() => {
    mock.restore();
    resetTelemetryForTests();
  });

  describe("isEnabled", () => {
    it("returns false when DISABLE_TELEMETRY=1", () => {
      const deps = createMockDeps({
        getEnv: (key) => (key === "DISABLE_TELEMETRY" ? "1" : undefined),
      });
      expect(isEnabled(deps)).toBe(false);
    });

    it("returns false when DO_NOT_TRACK=1", () => {
      const deps = createMockDeps({
        getEnv: (key) => (key === "DO_NOT_TRACK" ? "1" : undefined),
      });
      expect(isEnabled(deps)).toBe(false);
    });

    it("returns true by default", () => {
      const deps = createMockDeps();
      expect(isEnabled(deps)).toBe(true);
    });
  });

  describe("track", () => {
    it("does not call fetch when disabled via env", () => {
      const deps = createMockDeps({
        getEnv: (key) => (key === "DISABLE_TELEMETRY" ? "1" : undefined),
      });
      track({ command: "generate", startedAt: performance.now() }, deps);
      expect(deps.mockFetch).not.toHaveBeenCalled();
    });

    it("does not call fetch when command not in allowlist", () => {
      const deps = createMockDeps({
        getConfig: async () => ({
          version: "1.0.0",
          telemetry: { enabled: true, commands: ["generate"] },
        }),
      });
      track({ command: "credits", startedAt: performance.now() }, deps);
      expect(deps.mockFetch).not.toHaveBeenCalled();
    });

    it("sends correct query params for basic event", () => {
      const deps = createMockDeps();
      track({ command: "credits", startedAt: performance.now() }, deps);

      expect(deps.mockFetch).toHaveBeenCalledTimes(1);
      const url = getCalledUrl(deps.mockFetch);
      expect(url.searchParams.get("e")).toBe("credits");
      expect(url.searchParams.get("v")).toBe("0.2.0");
      expect(url.searchParams.get("sid")).toMatch(/^[0-9a-f]{12}$/);
      expect(url.searchParams.get("m")).toBeTruthy();
    });

    it("filters metadata through whitelist", () => {
      const deps = createMockDeps();
      track(
        {
          command: "generate",
          startedAt: performance.now(),
          metadata: {
            skillSlug: "seo-meta",
            model: "gpt-4o",
            secretField: "leaked",
          },
        },
        deps
      );

      const metadata = getCalledMetadata(deps.mockFetch);
      expect(metadata.skillSlug).toBe("seo-meta");
      expect(metadata.model).toBe("gpt-4o");
      expect(metadata).not.toHaveProperty("secretField");
    });

    it("includes platform fields in metadata", () => {
      const deps = createMockDeps();
      track({ command: "credits", startedAt: performance.now() }, deps);

      const metadata = getCalledMetadata(deps.mockFetch);
      expect(metadata.os).toBe("darwin");
      expect(metadata.arch).toBe("arm64");
      expect(metadata.isCi).toBe(false);
    });

    it("calculates durationMs from startedAt", () => {
      const deps = createMockDeps();
      const startedAt = performance.now() - 150;
      track({ command: "credits", startedAt }, deps);

      const metadata = getCalledMetadata(deps.mockFetch);
      expect(typeof metadata.durationMs).toBe("number");
      expect(metadata.durationMs as number).toBeGreaterThanOrEqual(100);
    });

    it("truncates query to 200 chars", () => {
      const deps = createMockDeps();
      const longQuery = "a".repeat(300);
      track(
        {
          command: "search",
          startedAt: performance.now(),
          metadata: { query: longQuery, resultCount: 5 },
        },
        deps
      );

      const metadata = getCalledMetadata(deps.mockFetch);
      expect((metadata.query as string).length).toBe(200);
    });

    it("swallows fetch errors silently", () => {
      const deps = createMockDeps({
        fetch: mock(() =>
          Promise.reject(new Error("network error"))
        ) as TMockFetch,
      });
      expect(() =>
        track({ command: "credits", startedAt: performance.now() }, deps)
      ).not.toThrow();
    });

    it("uses consistent session ID across calls", () => {
      const deps = createMockDeps();
      track({ command: "credits", startedAt: performance.now() }, deps);
      track({ command: "whoami", startedAt: performance.now() }, deps);

      const url1 = new URL(deps.mockFetch.mock.calls[0][0] as string);
      const url2 = new URL(deps.mockFetch.mock.calls[1][0] as string);
      expect(url1.searchParams.get("sid")).toBe(url2.searchParams.get("sid"));
    });

    it("sends success:true by default when not specified", () => {
      const deps = createMockDeps();
      track({ command: "credits", startedAt: performance.now() }, deps);

      const metadata = getCalledMetadata(deps.mockFetch);
      expect(metadata.success).toBe(true);
    });
  });

  describe("extractErrorData", () => {
    it("returns data from ApiError-like objects", () => {
      const error = {
        details: { data: { code: "INVALID_INPUT", field: "name" } },
      };
      expect(extractErrorData(error)).toEqual({
        code: "INVALID_INPUT",
        field: "name",
      });
    });

    it("returns undefined for plain errors", () => {
      expect(extractErrorData(new Error("fail"))).toBeUndefined();
    });
  });
});
