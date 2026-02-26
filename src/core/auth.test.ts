import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizeApiKey,
  readApiKeyFromAuthConfig,
  resolveAuthConfigPath,
  saveAuthConfig,
  verifyApiKey,
} from "./auth";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-auth-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  mock.restore();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("auth core", () => {
  it("resolves auth config path from home directory", () => {
    const configPath = resolveAuthConfigPath(() => "/tmp/demo-home");

    expect(configPath).toBe(path.join("/tmp/demo-home", ".betterprompt", "config.json"));
  });

  it("creates config directory and writes auth config", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    const savedPath = await saveAuthConfig("abc123", {
      configPath,
      now: new Date("2026-02-25T00:00:00.000Z"),
    });

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(savedPath).toBe(configPath);
    expect(parsed.auth).toEqual({
      apiKey: "abc123",
      updatedAt: "2026-02-25T00:00:00.000Z",
    });
  });

  it("preserves unknown fields and updates apiKey and updatedAt", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await mkdir(path.dirname(configPath), { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          version: "0.0.1",
          apiBaseUrl: "https://betterprompt.me/api",
          auth: {
            apiKey: "old",
            updatedAt: "2020-01-01T00:00:00.000Z",
          },
          profile: { id: "user-1" },
        },
        null,
        2,
      ),
    );

    await saveAuthConfig("new-key", {
      configPath,
      now: new Date("2026-02-25T00:00:00.000Z"),
    });

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;

    expect((parsed.auth as Record<string, unknown>).apiKey).toBe("new-key");
    expect((parsed.auth as Record<string, unknown>).updatedAt).toBe(
      "2026-02-25T00:00:00.000Z"
    );
    expect(parsed.profile).toBeUndefined();
    expect(parsed.version).toBe("0.0.1");
    expect(parsed.apiBaseUrl).toBe("https://betterprompt.me/api");
  });

  it("rejects empty API keys", () => {
    expect(() => normalizeApiKey("")).toThrow("API key cannot be empty.");
    expect(() => normalizeApiKey("   ")).toThrow("API key cannot be empty.");
    expect(normalizeApiKey("  abc123  ")).toBe("abc123");
  });

  it("reads api key from auth config", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({ auth: { apiKey: "  test-key  " } }, null, 2)
    );

    const apiKey = await readApiKeyFromAuthConfig({ configPath });

    expect(apiKey).toBe("test-key");
  });

  it("throws when auth config does not exist", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "config.json");

    await expect(readApiKeyFromAuthConfig({ configPath })).rejects.toThrow(
      "API key not found. Run `betterprompt config set apiKey <value>` to configure config.json."
    );
  });

  it("verifies api key by calling GET /me", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await verifyApiKey("bp_key_123", {
      baseUrl: "https://api.example.com",
      fetch: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://api.example.com/me");
    expect(init.method).toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer bp_key_123");
  });

  it("throws when api key verification endpoint returns an error", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      verifyApiKey("bp_bad_key", {
        baseUrl: "https://api.example.com",
        fetch: fetchMock,
      })
    ).rejects.toThrow("API key verification failed. Unauthorized");
  });
});
