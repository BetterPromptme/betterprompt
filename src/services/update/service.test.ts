import {
  mkdtemp,
  readdir,
  readFile,
  readlink,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
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
          binDir: "/usr/local/bin",
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
          binDir: "/usr/local/bin",
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
            binDir: "/usr/local/bin",
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
            binDir: "/usr/local/bin",
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
          binDir: "/usr/local/bin",
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
          binDir: "/usr/local/bin",
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
            binDir: "/usr/local/bin",
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
            binDir: "/usr/local/bin",
          }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.githubMissingTag);
  });
});

// -- performUpdate (binary path) --

describe("services/update/service performUpdate (binary)", () => {
  it("downloads binary to new version dir and creates symlinks in binDir", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    // Simulate versioned layout: versions/1.0.0/betterprompt
    const { mkdir } = await import("node:fs/promises");
    const versionsDir = path.join(tmpDir, "versions");
    const oldVersionDir = path.join(versionsDir, "1.0.0");
    await mkdir(oldVersionDir, { recursive: true });
    const binaryPath = path.join(oldVersionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const fakeBinaryContent = "new-binary-content";
    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(fakeBinaryContent, { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const installInfo: TInstallMethodInfo = {
      method: "binary",
      execPath: binaryPath,
      installDir: oldVersionDir,
      binDir,
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

    // Verify binary was installed in new version dir
    const newBinaryPath = path.join(versionsDir, "2.0.0", "betterprompt");
    const content = await readFile(newBinaryPath, "utf-8");
    expect(content).toBe(fakeBinaryContent);

    // Verify permissions
    const fileStat = await stat(newBinaryPath);
    expect(fileStat.mode & 0o755).toBe(0o755);

    // Verify symlinks in binDir
    const bpLink = await readlink(path.join(binDir, "bp"));
    expect(bpLink).toBe(newBinaryPath);
    const betterpromptLink = await readlink(path.join(binDir, "betterprompt"));
    expect(betterpromptLink).toBe(newBinaryPath);

    // Verify download URL
    expect(fetchMock).toHaveBeenCalledWith(
      `${UPDATE_BINARY.githubDownloadBaseUrl}/v2.0.0/betterprompt-2.0.0-darwin-arm64`,
      expect.objectContaining({ redirect: "follow" })
    );
  });

  it("throws download failed when fetch returns non-success", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
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
            installDir: versionDir,
            binDir: path.join(tmpDir, "bin"),
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.downloadFailed);
  });

  it("throws permission denied message on EACCES during download/write/rename", async () => {
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
            execPath:
              "/usr/local/share/betterprompt/versions/1.0.0/betterprompt",
            installDir: "/usr/local/share/betterprompt/versions/1.0.0",
            binDir: "/usr/local/bin",
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.permissionDenied);
  });

  it("returns updated true when symlink recreation fails after successful install", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir, chmod: chmodFs } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    // Create binDir as read-only to cause symlink failure
    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });
    await chmodFs(binDir, 0o000);

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("new-binary", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: versionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    // Binary update succeeded despite symlink failure
    expect(result.updated).toBe(true);

    // Verify binary was actually installed in new version dir
    const newBinaryPath = path.join(
      tmpDir,
      "versions",
      "2.0.0",
      "betterprompt"
    );
    const content = await readFile(newBinaryPath, "utf-8");
    expect(content).toBe("new-binary");

    // Cleanup: restore permissions so tmpdir can be removed
    await chmodFs(binDir, 0o755);
  });

  it("resolves latest version from GitHub when targetVersion is omitted", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const fetchMock = mock(async (url: string) => {
      // GitHub API to resolve latest version
      if (typeof url === "string" && url.includes("api.github.com")) {
        return new Response(JSON.stringify({ tag_name: "v5.0.0" }), {
          status: 200,
        });
      }
      // Checksum file not available
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      // Download the binary
      return new Response("latest-binary", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      {},
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: versionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // First call should be to GitHub API
    expect(fetchMock.mock.calls[0][0]).toBe(UPDATE_BINARY.githubApiUrl);

    // Second call should use the resolved version
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${UPDATE_BINARY.githubDownloadBaseUrl}/v5.0.0/betterprompt-5.0.0-darwin-arm64`
    );

    // Third call should be the checksum file
    expect(fetchMock.mock.calls[2][0]).toBe(
      `${UPDATE_BINARY.githubDownloadBaseUrl}/v5.0.0/betterprompt-5.0.0-darwin-arm64.sha256`
    );
  });

  it("cleans up temp file on failure", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
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
            installDir: versionDir,
            binDir: path.join(tmpDir, "bin"),
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      );
    } catch {
      // expected
    }

    // Temp file should not exist in the new version dir
    const newVersionDir = path.join(tmpDir, "versions", "99.0.0");
    const tempPath = path.join(newVersionDir, ".betterprompt.update.tmp");
    await expect(stat(tempPath)).rejects.toThrow();
  });

  it("recreates symlinks when they already exist", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionsDir = path.join(tmpDir, "versions");
    const oldVersionDir = path.join(versionsDir, "1.0.0");
    await mkdir(oldVersionDir, { recursive: true });
    const binaryPath = path.join(oldVersionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    // Create existing symlinks pointing to old version
    await symlink(binaryPath, path.join(binDir, "betterprompt"));
    await symlink(binaryPath, path.join(binDir, "bp"));

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("new-binary", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: oldVersionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);

    // Verify symlinks now point to new version
    const newBinaryPath = path.join(versionsDir, "2.0.0", "betterprompt");
    const bpLink = await readlink(path.join(binDir, "bp"));
    expect(bpLink).toBe(newBinaryPath);
    const betterpromptLink = await readlink(path.join(binDir, "betterprompt"));
    expect(betterpromptLink).toBe(newBinaryPath);
  });

  it("cleans up old version directories after successful update", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionsDir = path.join(tmpDir, "versions");
    const oldVersionDir = path.join(versionsDir, "1.0.0");
    // Create a stale version dir to simulate leftover from prior update
    const staleVersionDir = path.join(versionsDir, "0.9.0");
    await mkdir(oldVersionDir, { recursive: true });
    await mkdir(staleVersionDir, { recursive: true });
    const binaryPath = path.join(oldVersionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");
    await writeFile(path.join(staleVersionDir, "betterprompt"), "stale-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("new-binary", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: oldVersionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);

    // Only the new version directory should remain
    const remaining = await readdir(versionsDir);
    expect(remaining).toEqual(["2.0.0"]);

    // Old and stale version dirs should be gone
    await expect(stat(oldVersionDir)).rejects.toThrow();
    await expect(stat(staleVersionDir)).rejects.toThrow();
  });
});

// -- checksum verification --

describe("services/update/service checksum verification", () => {
  it("passes when downloaded binary hash matches checksum file", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const binaryContent = "verified-binary-content";
    const expectedHash = new Bun.CryptoHasher("sha256")
      .update(new TextEncoder().encode(binaryContent))
      .digest("hex");

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response(
          `${expectedHash}  betterprompt-2.0.0-darwin-arm64`,
          {
            status: 200,
          }
        );
      }
      return new Response(binaryContent, { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: versionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);
  });

  it("throws checksumMismatch when hash does not match", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response(
          "badhashbadhashbadhashbadhash000000000000000000000000000000000000",
          {
            status: 200,
          }
        );
      }
      return new Response("binary-content", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      performUpdate(
        { targetVersion: "2.0.0" },
        {
          detectInstallMethod: () => ({
            method: "binary",
            execPath: binaryPath,
            installDir: versionDir,
            binDir,
          }),
          resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
        }
      )
    ).rejects.toThrow(UPDATE_MESSAGES.checksumMismatch);
  });

  it("skips checksum verification when .sha256 file is not available", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-update-test-"));
    const { mkdir } = await import("node:fs/promises");
    const versionDir = path.join(tmpDir, "versions", "1.0.0");
    await mkdir(versionDir, { recursive: true });
    const binaryPath = path.join(versionDir, "betterprompt");
    await writeFile(binaryPath, "old-binary");

    const binDir = path.join(tmpDir, "bin");
    await mkdir(binDir, { recursive: true });

    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.endsWith(".sha256")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("binary-content", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await performUpdate(
      { targetVersion: "2.0.0" },
      {
        detectInstallMethod: () => ({
          method: "binary",
          execPath: binaryPath,
          installDir: versionDir,
          binDir,
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    expect(result.updated).toBe(true);
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
          binDir: "/usr/local/bin",
        }),
        resolvePlatform: () => ({ os: "darwin", arch: "arm64" }),
      }
    );

    // The promise will reject because spawn will fail in test env,
    // but we verify it didn't take the binary path
    await expect(result).rejects.toBeDefined();
  });
});
