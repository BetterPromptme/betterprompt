import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getCredits,
  getCurrentUser,
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

    expect(configPath).toBe(path.join("/tmp/demo-home", ".betterprompt", "auth.json"));
  });

  it("writes auth state to auth.json and not legacy config.json", async () => {
    const tempDir = await createTempDir();
    const authConfigPath = path.join(tempDir, ".betterprompt", "auth.json");
    const legacyConfigPath = path.join(tempDir, ".betterprompt", "config.json");

    const savedPath = await saveAuthConfig("abc123", {
      configPath: authConfigPath,
      now: new Date("2026-03-03T00:00:00.000Z"),
    });

    expect(savedPath).toBe(authConfigPath);
    await expect(readFile(authConfigPath, "utf8")).resolves.toContain("abc123");
    await expect(readFile(legacyConfigPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("creates config directory and writes flat auth config", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "auth.json");

    const savedPath = await saveAuthConfig("abc123", {
      configPath,
      now: new Date("2026-02-25T00:00:00.000Z"),
    });

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(savedPath).toBe(configPath);
    expect(parsed.apiKey).toBe("abc123");
    expect(parsed.updatedAt).toBe("2026-02-25T00:00:00.000Z");
    expect(parsed.auth).toBeUndefined();
    expect(parsed.version).toBeUndefined();
    expect(parsed.apiBaseUrl).toBeUndefined();
  });

  it("overwrites auth.json with flat {apiKey, updatedAt} only", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "auth.json");
    await mkdir(path.dirname(configPath), { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        { apiKey: "old", updatedAt: "2020-01-01T00:00:00.000Z" },
        null,
        2,
      ),
    );

    await saveAuthConfig("new-key", {
      configPath,
      now: new Date("2026-02-25T00:00:00.000Z"),
    });

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;

    expect(parsed.apiKey).toBe("new-key");
    expect(parsed.updatedAt).toBe("2026-02-25T00:00:00.000Z");
    expect(Object.keys(parsed)).toEqual(["apiKey", "updatedAt"]);
  });

  it("rejects empty API keys", () => {
    expect(() => normalizeApiKey("")).toThrow("API key cannot be empty.");
    expect(() => normalizeApiKey("   ")).toThrow("API key cannot be empty.");
    expect(normalizeApiKey("  abc123  ")).toBe("abc123");
  });

  it("reads api key from flat auth.json", async () => {
    const tempDir = await createTempDir();
    const authConfigPath = path.join(tempDir, ".betterprompt", "auth.json");
    await mkdir(path.dirname(authConfigPath), { recursive: true });
    await writeFile(
      authConfigPath,
      JSON.stringify({ apiKey: "  auth-json-key  ", updatedAt: "2026-03-03T00:00:00.000Z" }, null, 2)
    );

    const apiKey = await readApiKeyFromAuthConfig({ configPath: authConfigPath });

    expect(apiKey).toBe("auth-json-key");
  });

  it("reads api key from legacy nested auth.json format", async () => {
    const tempDir = await createTempDir();
    const authConfigPath = path.join(tempDir, ".betterprompt", "auth.json");
    await mkdir(path.dirname(authConfigPath), { recursive: true });
    await writeFile(
      authConfigPath,
      JSON.stringify({ auth: { apiKey: "  legacy-nested-key  " } }, null, 2)
    );

    const apiKey = await readApiKeyFromAuthConfig({ configPath: authConfigPath });

    expect(apiKey).toBe("legacy-nested-key");
  });

  it("falls back to legacy config.json when auth.json is missing", async () => {
    const tempDir = await createTempDir();
    const betterpromptDir = path.join(tempDir, ".betterprompt");
    const authConfigPath = path.join(betterpromptDir, "auth.json");
    const legacyConfigPath = path.join(betterpromptDir, "config.json");
    await mkdir(betterpromptDir, { recursive: true });
    await writeFile(
      legacyConfigPath,
      JSON.stringify({ auth: { apiKey: "legacy-config-key" } }, null, 2)
    );

    const apiKey = await readApiKeyFromAuthConfig({ configPath: authConfigPath });

    expect(apiKey).toBe("legacy-config-key");
  });

  it("does not use legacy fallback when auth.json exists but is missing api key", async () => {
    const tempDir = await createTempDir();
    const betterpromptDir = path.join(tempDir, ".betterprompt");
    const authConfigPath = path.join(betterpromptDir, "auth.json");
    const legacyConfigPath = path.join(betterpromptDir, "config.json");
    await mkdir(betterpromptDir, { recursive: true });
    await writeFile(authConfigPath, JSON.stringify({ auth: {} }, null, 2));
    await writeFile(
      legacyConfigPath,
      JSON.stringify({ auth: { apiKey: "legacy-config-key" } }, null, 2)
    );

    await expect(
      readApiKeyFromAuthConfig({ configPath: authConfigPath })
    ).rejects.toThrow(
      "API key not found. Run `betterprompt config set apiKey <value>` to configure auth.json."
    );
  });

  it("throws when auth config does not exist", async () => {
    const tempDir = await createTempDir();
    const configPath = path.join(tempDir, ".betterprompt", "auth.json");

    await expect(readApiKeyFromAuthConfig({ configPath })).rejects.toThrow(
      "API key not found. Run `betterprompt config set apiKey <value>` to configure auth.json."
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

  it("returns current user identity when api response is successful", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: {
          username: "jane",
          displayName: "Jane Doe",
          userFlags: 0,
        },
      })),
    };

    const result = await getCurrentUser(apiClient);

    expect(apiClient.get).toHaveBeenCalledWith("/me");
    expect(result).toEqual({
      username: "jane",
      displayName: "Jane Doe",
      userFlags: 0,
    });
  });

  it("throws response message when current user payload is not successful", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "FAILED",
        message: "Unauthorized",
      })),
    };

    await expect(getCurrentUser(apiClient)).rejects.toThrow("Unauthorized");
  });

  it("returns credits balance when api response is successful", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: {
          balance: 1250,
          currency: "USD",
          updatedAt: "2026-03-03T12:00:00.000Z",
        },
      })),
    };

    const result = await getCredits(apiClient);

    expect(apiClient.get).toHaveBeenCalledWith("/me/credits");
    expect(result).toEqual({
      balance: 1250,
      currency: "USD",
      updatedAt: "2026-03-03T12:00:00.000Z",
    });
  });

  it("throws response message when credits payload is not successful", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "FAILED",
        message: "Unauthorized",
      })),
    };

    await expect(getCredits(apiClient)).rejects.toThrow("Unauthorized");
  });
});
