import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import packageJson from "../../../package.json";
import { UPDATE_BINARY, UPDATE_MESSAGES } from "../../constants/update";
import type {
  TCheckForUpdateOptions,
  TCheckForUpdateResult,
  TGitHubRelease,
  TInstallMethodInfo,
  TPerformUpdateOptions,
  TPerformUpdateResult,
  TPlatformInfo,
} from "../../types/update";
import { isCommandAvailable } from "../../utils/command";
import { detectInstallMethod } from "../../utils/install-method";
import { resolvePlatform } from "../../utils/platform";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

type TNpmMetadata = {
  "dist-tags"?: {
    latest?: string;
  };
};

type TPackageManagerInfo = {
  command: string;
  args: (pkg: string, registry: string) => string[];
};

const PM_BUN: TPackageManagerInfo = {
  command: "bun",
  args: (pkg, registry) => ["add", "-g", pkg, "--registry", registry],
};

const PM_NPM: TPackageManagerInfo = {
  command: "npm",
  args: (pkg, registry) => ["install", "-g", pkg, "--registry", registry],
};

export const detectPackageManager = (): TPackageManagerInfo => {
  if (isCommandAvailable("bun")) return PM_BUN;
  if (isCommandAvailable("npm")) return PM_NPM;
  throw new Error(UPDATE_MESSAGES.noPackageManager);
};

const normalizeRegistry = (registry: string | undefined): string =>
  (registry ?? DEFAULT_REGISTRY).replace(/\/+$/, "");

type TCheckForUpdateDeps = {
  detectInstallMethod: () => TInstallMethodInfo;
};

const defaultCheckDeps: TCheckForUpdateDeps = {
  detectInstallMethod,
};

const checkFromGitHub = async (
  currentVersion: string
): Promise<TCheckForUpdateResult> => {
  const response = await fetch(UPDATE_BINARY.githubApiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    throw new Error(`${UPDATE_MESSAGES.githubApiFailed} (${response.status})`);
  }

  const release = (await response.json()) as TGitHubRelease;
  const tagName = release.tag_name;

  if (typeof tagName !== "string" || tagName.trim().length === 0) {
    throw new Error(UPDATE_MESSAGES.githubMissingTag);
  }

  const latestVersion = tagName.replace(/^v/, "");

  return {
    currentVersion,
    latestVersion,
    hasUpdate: latestVersion !== currentVersion,
  };
};

const checkFromRegistry = async (
  currentVersion: string,
  registry: string
): Promise<TCheckForUpdateResult> => {
  const packageName = encodeURIComponent(String(packageJson.name));
  const response = await fetch(`${registry}/${packageName}`);

  if (!response.ok) {
    throw new Error(
      `${UPDATE_MESSAGES.registryQueryFailed} (${response.status})`
    );
  }

  const metadata = (await response.json()) as TNpmMetadata;
  const latestVersion = metadata["dist-tags"]?.latest;

  if (typeof latestVersion !== "string" || latestVersion.trim().length === 0) {
    throw new Error(UPDATE_MESSAGES.registryMissingVersion);
  }

  return {
    currentVersion,
    latestVersion,
    hasUpdate: latestVersion !== currentVersion,
  };
};

export const checkForUpdate = async (
  options: TCheckForUpdateOptions = {},
  deps: TCheckForUpdateDeps = defaultCheckDeps
): Promise<TCheckForUpdateResult> => {
  const currentVersion = String(packageJson.version);
  const installInfo = deps.detectInstallMethod();

  if (installInfo.method === "binary") {
    return checkFromGitHub(currentVersion);
  }

  const registry = normalizeRegistry(options.registry);
  return checkFromRegistry(currentVersion, registry);
};

type TPerformUpdateDeps = {
  detectInstallMethod: () => TInstallMethodInfo;
  resolvePlatform: () => TPlatformInfo;
};

const defaultPerformDeps: TPerformUpdateDeps = {
  detectInstallMethod,
  resolvePlatform,
};

const performBinaryUpdate = async (
  targetVersion: string | undefined,
  installInfo: TInstallMethodInfo,
  platform: TPlatformInfo
): Promise<TPerformUpdateResult> => {
  let version = targetVersion;
  if (!version) {
    const latest = await checkFromGitHub(String(packageJson.version));
    version = latest.latestVersion;
  }

  const fileName = `${UPDATE_BINARY.binaryName}-${version}-${platform.os}-${platform.arch}`;
  const downloadUrl = `${UPDATE_BINARY.githubDownloadBaseUrl}/v${version}/${fileName}`;

  // Compute new version dir as sibling of current version dir
  const newVersionDir = path.join(
    path.dirname(installInfo.installDir),
    version
  );
  const newBinaryPath = path.join(newVersionDir, UPDATE_BINARY.binaryName);
  const tempPath = path.join(
    newVersionDir,
    `.${UPDATE_BINARY.binaryName}.update.tmp`
  );

  // Phase 1: download + install binary into new version dir
  try {
    await mkdir(newVersionDir, { recursive: true });

    const response = await fetch(downloadUrl, { redirect: "follow" });

    if (!response.ok) {
      throw new Error(`${UPDATE_MESSAGES.downloadFailed} (${response.status})`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());

    // Verify checksum if .sha256 file is available
    const checksumUrl = `${downloadUrl}.sha256`;
    const checksumResponse = await fetch(checksumUrl, { redirect: "follow" });
    if (checksumResponse.ok) {
      const expectedHash = (await checksumResponse.text())
        .trim()
        .split(/\s+/)[0];
      const hash = new Bun.CryptoHasher("sha256").update(buffer).digest("hex");
      if (hash !== expectedHash) {
        throw new Error(UPDATE_MESSAGES.checksumMismatch);
      }
    } else if (checksumResponse.status !== 404) {
      throw new Error(
        `${UPDATE_MESSAGES.checksumFetchFailed} (${checksumResponse.status})`
      );
    }

    await writeFile(tempPath, buffer);
    await chmod(tempPath, 0o755);
    await rename(tempPath, newBinaryPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      throw new Error(UPDATE_MESSAGES.permissionDenied);
    }
    throw error;
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // temp file may already be renamed or not exist
    }
  }

  // Phase 2: recreate symlinks in binDir — best-effort, binary is already installed
  const recreateSymlink = async (name: string) => {
    const linkPath = path.join(installInfo.binDir, name);
    try {
      await unlink(linkPath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await symlink(newBinaryPath, linkPath);
  };

  try {
    await recreateSymlink(UPDATE_BINARY.binaryName);
    await recreateSymlink(UPDATE_BINARY.symlinkName);
  } catch {
    // Symlink recreation failed but binary update succeeded — not fatal
  }

  return { updated: true };
};

const performPackageManagerUpdate = async (
  options: TPerformUpdateOptions
): Promise<TPerformUpdateResult> => {
  const packageName = String(packageJson.name);
  const target = options.targetVersion ? `@${options.targetVersion}` : "";
  const registry = normalizeRegistry(options.registry);
  const pm = detectPackageManager();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      pm.command,
      pm.args(`${packageName}${target}`, registry),
      {
        stdio: "ignore",
      }
    );

    child.once("error", (error) => {
      reject(error);
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Update process exited with code ${String(code)}`));
    });
  });

  return { updated: true };
};

export const performUpdate = async (
  options: TPerformUpdateOptions = {},
  deps: TPerformUpdateDeps = defaultPerformDeps
): Promise<TPerformUpdateResult> => {
  const installInfo = deps.detectInstallMethod();

  if (installInfo.method === "binary") {
    const platform = deps.resolvePlatform();
    return performBinaryUpdate(options.targetVersion, installInfo, platform);
  }

  return performPackageManagerUpdate(options);
};
