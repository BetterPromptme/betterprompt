import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readApiKeyFromAuthConfig } from "../auth/service";
import { getApiClient, resetApiClientForTests } from "./client";
import { loadOrInitConfig, resetSystemConfigForTests } from "../config/service";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-api-"));
  tempDirs.push(dir);
  return dir;
};

describe("api client", () => {
  afterEach(async () => {
    resetApiClientForTests();
    resetSystemConfigForTests();
    mock.restore();
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  it("returns the same singleton instance", () => {
    const clientA = getApiClient({ baseUrl: "https://api.example.com" });
    const clientB = getApiClient();

    expect(clientA).toBe(clientB);
  });

  it("applies base url, query params, and bearer authorization header", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      getApiKey: () => "bp_test_key",
    });

    await client.get<{ ok: boolean }>("/v1/user", {
      query: {
        page: 1,
        active: true,
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://api.example.com/v1/user?page=1&active=true");
    expect(init.method).toBe("GET");

    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer bp_test_key");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("does not duplicate bearer scheme when token already includes it", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      getApiKey: () => "Bearer bp_test_key",
    });

    await client.get("/v1/user");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get("authorization")).toBe("Bearer bp_test_key");
  });

  it("serializes json body for post requests", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      getApiKey: () => "bp_test_key",
    });

    await client.post("/v1/items", { name: "test" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(init.body).toBe('{"name":"test"}');
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("throws ApiError for non-2xx responses", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({ message: "Unauthorized", code: "AUTH_401" }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        }
      );
    });

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      getApiKey: () => "bp_test_key",
    });

    await expect(client.get("/v1/private")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "AUTH_401",
      message: "Unauthorized",
    });
  });

  it("throws timeout ApiError when request exceeds timeout", async () => {
    const fetchMock = mock(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";

          if (init?.signal?.aborted) {
            reject(abortError);
            return;
          }

          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(abortError);
            },
            { once: true }
          );
        })
    );

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      timeoutMs: 10,
      getApiKey: () => "bp_test_key",
    });

    await expect(client.get("/v1/slow")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message: "Request timed out after 10ms",
    });
  });

  it("does not classify user-provided signal aborts as timeout", async () => {
    const fetchMock = mock(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";

          if (init?.signal?.aborted) {
            reject(abortError);
            return;
          }

          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(abortError);
            },
            { once: true }
          );
        })
    );

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      timeoutMs: 1_000,
      getApiKey: () => "bp_test_key",
    });

    const userController = new AbortController();
    const requestPromise = client.get("/v1/cancel", { signal: userController.signal });
    userController.abort();

    await expect(requestPromise).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message: "Request aborted",
    });
  });

  it("loads api key from config.json provider", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({ auth: { apiKey: "bp_from_file" } }, null, 2)
    );

    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
      getApiKey: () => readApiKeyFromAuthConfig({ configPath }),
    });

    await client.get("/v1/profile");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer bp_from_file");
  });

  it("throws when config.json does not exist and no auth header is provided", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    const client = getApiClient({
      baseUrl: "https://api.example.com",
      fetch: mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      getApiKey: () => readApiKeyFromAuthConfig({ configPath }),
    });

    await expect(client.get("/v1/profile")).rejects.toThrow(
      "API key not found. Run `betterprompt config set apiKey <value>` to configure auth.json."
    );
  });

  it("uses apiBaseUrl from loaded system config and preserves base path", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify(
        {
          version: "0.0.1",
          apiBaseUrl: "https://runtime.example/api",
          auth: {},
        },
        null,
        2
      )
    );
    await loadOrInitConfig({ configPath });

    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = getApiClient({
      fetch: fetchMock,
      getApiKey: () => "bp_test_key",
    });
    await client.get("/v1/me");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://runtime.example/api/v1/me");
  });
});
