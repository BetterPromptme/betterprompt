import { describe, expect, it, mock } from "bun:test";
import { checkForUpdate } from "./service";

describe("services/update/service checkForUpdate", () => {
  it("returns update availability from registry metadata", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          "dist-tags": {
            latest: "9.9.9",
          },
        }),
        { status: 200 }
      )
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await checkForUpdate({
        registry: "https://registry.npmjs.org/",
      });

      expect(result).toEqual(
        expect.objectContaining({
          latestVersion: "9.9.9",
          hasUpdate: expect.any(Boolean),
        })
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes trailing slash in registry URL", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          "dist-tags": {
            latest: "9.9.9",
          },
        }),
        { status: 200 }
      )
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await checkForUpdate({
        registry: "https://registry.npmjs.org///",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/registry\.npmjs\.org\/.+/)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when registry returns a non-success HTTP status", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () => new Response("{}", { status: 500 }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(checkForUpdate()).rejects.toThrow("Failed to query registry (500)");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when registry metadata is missing latest version", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          "dist-tags": {},
        }),
        { status: 200 }
      )
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(checkForUpdate()).rejects.toThrow(
        "Registry response missing latest version"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
