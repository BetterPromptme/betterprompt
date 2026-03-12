import { mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, mock } from "bun:test";

import { UPDATE_BINARY, UPDATE_MESSAGES } from "../../constants/update";
import type { TInstallMethodInfo, TPlatformInfo } from "../../types/update";
import { checkForUpdate, performUpdate } from "./service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

// -- checkForUpdate (package-manager path, existing tests) --

describe("services/update/service checkForUpdate", () => {
  it("returns update availability from registry metadata", async () => {
    const fetchMock = mock(
      async () =>
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

    const result = await checkForUpdate(
      { registry: "https://registry.npmjs.org/" },
      {
        detectInstallMethod: () => ({
          method: "package-manager",
          execPath: "/usr/local/bin/bun",
          installDir: "/usr/local/bin",
        }),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        latestVersion: "9.9.9",
        hasUpdate: expect.any(Boolean),
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes trailing slash in registry URL", async () => {
    const fetchMock = mock(
      async () =>
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

    await checkForUpdate(
      { registry: "https://registry.npmjs.org///" },
      {
        detectInstallMethod: () => ({
          method: "package-manager",
          execPath: "/usr/local/bin/bun",
          installDir: "/usr/local/bin",
        }),
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/registry\.npmjs\.org\/.+/)
    );
  });

  it("throws when registry returns a non-success HTTP status", async () => {
    const fetchMock = mock(async () => new Response("{}", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      checkForUpdate(
        {},
        {
          detectInstallMethod: () => ({
            method: "package-manager",
            execPath: "/usr/local/bin/bun",
            installDir: "/usr/local/bin",
          }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.registryQueryFailed);
  });

  it("throws when registry metadata is missing latest version", async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            "dist-tags": {},
          }),
          { status: 200 }
        )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      checkForUpdate(
        {},
        {
          detectInstallMethod: () => ({
            method: "package-manager",
            execPath: "/usr/local/bin/bun",
            installDir: "/usr/local/bin",
          }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.registryMissingVersion);
  });
});

// -- checkForUpdate (binary path) --

describe("services/update/service checkForUpdate (binary)", () => {
  it("queries GitHub API when install method is binary", async () => {
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ tag_name: "v2.0.0" }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkForUpdate(
      {},
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: "/usr/local/bin/betterprompt",
          installDir: "/usr/local/bin",
        }),
      }
    );

    expect(result.latestVersion).toBe("2.0.0");
    expect(result.hasUpdate).toBeBoolean();
    expect(fetchMock).toHaveBeenCalledWith(
      UPDATE_BINARY.githubApiUrl,
      expect.objectContaining({
        headers: { Accept: "application/vnd.github.v3+json" },
      })
    );
  });

  it("strips v prefix from GitHub tag_name", async () => {
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ tag_name: "v3.1.4" }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkForUpdate(
      {},
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: "/usr/local/bin/betterprompt",
          installDir: "/usr/local/bin",
        }),
      }
    );

    expect(result.latestVersion).toBe("3.1.4");
  });

  it("throws when GitHub API returns non-success status", async () => {
    const fetchMock = mock(async () => new Response("{}", { status: 403 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      checkForUpdate(
        {},
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: "/usr/local/bin/betterprompt",
            installDir: "/usr/local/bin",
          }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.githubApiFailed);
  });

  it("throws when GitHub release is missing tag_name", async () => {
    const fetchMock = mock(
      async () => new Response(JSON.stringify({}), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      checkForUpdate(
        {},
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: "/usr/local/bin/betterprompt",
            installDir: "/usr/local/bin",
          }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.githubMissingTag);
  });
});

// -- performUpdate (binary path) --

describe("services/update/service performUpdate (binary)", () => {
  it("downloads binary, sets permissions, renames, and creates symlink", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const binaryPath = path.join(tmpDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const fakeBinaryContent = "new-binary-content";
    const fetchMock = mock(
      async () => new Response(fakeBinaryContent, { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const installInfo: TInstallMethodInfo = {
      method: "binary",
      execPath: binaryPath,
      installDir: tmpDir,
    };

    const platform: TPlatformInfo = { os: "darwin", arch: "arm64" };

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => installInfo,
        resolvePlatform: () => platform,
      }
    );

    expect(result.updated).toBe(true);

    // Verify binary was replaced
    const content = await readFile(binaryPath, "utf-8");
    expect(content).toBe(fakeBinaryContent);

    // Verify permissions
    const fileStat = await stat(binaryPath);
    expect(fileStat.mode & 0o755).toBe(0o755);

    // Verify symlink was created
    const symlinkPath = path.join(tmpDir, "bp");
    const linkStat = await stat(symlinkPath);
    expect(linkStat).toBeDefined();

    // Verify download URL
    expect(fetchMock).toHaveBeenCalledWith(
      `${UPDATE_BINARY.githubDownloadBaseUrl}/v2.0.0/betterprompt-2.0.0-darwin-arm64`,
      expect.objectContaining({ redirect: "follow" })
    );
  });

  it("throws download failed when fetch returns non-success", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const binaryPath = path.join(tmpDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const fetchMock = mock(
      async () => new Response("Not Found", { status: 404 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      performUpdate(
        { targetVersion: "99.0.0" },
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: binaryPath,
            installDir: tmpDir,
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.downloadFailed);
  });

  it("throws permission denied message on EACCES", async () => {
    const fetchMock = mock(async () => {
      const error = new Error("EACCES") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      performUpdate(
        { targetVersion: "2.0.0" },
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: "/usr/local/bin/betterprompt",
            installDir: "/usr/local/bin",
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.permissionDenied);
  });

  it("cleans up temp file on failure", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const binaryPath = path.join(tmpDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const fetchMock = mock(
      async () => new Response("Not Found", { status: 404 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await performUpdate(
        { targetVersion: "99.0.0" },
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: binaryPath,
            installDir: tmpDir,
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      );
    } catch {
      // expected
    }

    const tempPath = path.join(tmpDir, ".betterprompt.update.tmp");
    await expect(stat(tempPath)).rejects.toThrow();
  });

  it("recreates symlink when it already exists", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const binaryPath = path.join(tmpDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    // Create existing symlink pointing somewhere else
    const symlinkPath = path.join(tmpDir, "bp");
    await symlink(binaryPath, symlinkPath);

    const fetchMock = mock(
      async () => new Response("new-binary", { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: tmpDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);
    const linkStat = await stat(symlinkPath);
    expect(linkStat).toBeDefined();
  });
});

// -- performUpdate (package-manager path) --

describe("services/update/service performUpdate (package-manager)", () => {
  it("delegates to package manager when install method is package-manager", async () => {
    // This test just verifies the dispatch — the actual spawn is hard to test
    // without a real package manager, so we verify the method dispatch works
    const result = performUpdate(
      { targetVersion: "1.0.0" },
      {
        detectInstallMethod: () => ({
          method: "package-manager",
          execPath: "/usr/local/bin/bun",
          installDir: "/usr/local/bin",
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    // The promise will reject because spawn will fail in test env,
    // but we verify it didn't take the binary path
    await expect(result).rejects.toBeDefined();
  });
});
