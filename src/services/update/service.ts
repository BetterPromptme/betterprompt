import { spawn } from "node:child_process";
import packageJson from "../../../package.json";
import type {
  TCheckForUpdateOptions,
  TCheckForUpdateResult,
  TPerformUpdateOptions,
  TPerformUpdateResult,
} from "../../types/update";
import { isCommandAvailable } from "../../utils/command";

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
  throw new Error(
    "No supported package manager found. Please install bun or npm."
  );
};

const normalizeRegistry = (registry: string | undefined): string =>
  (registry ?? DEFAULT_REGISTRY).replace(/\/+$/, "");

export const checkForUpdate = async (
  options: TCheckForUpdateOptions = {}
): Promise<TCheckForUpdateResult> => {
  const currentVersion = String(packageJson.version);
  const packageName = encodeURIComponent(String(packageJson.name));
  const registry = normalizeRegistry(options.registry);
  const response = await fetch(`${registry}/${packageName}`);

  if (!response.ok) {
    throw new Error(`Failed to query registry (${response.status})`);
  }

  const metadata = (await response.json()) as TNpmMetadata;
  const latestVersion = metadata["dist-tags"]?.latest;
  if (typeof latestVersion !== "string" || latestVersion.trim().length === 0) {
    throw new Error("Registry response missing latest version");
  }

  return {
    currentVersion,
    latestVersion,
    hasUpdate: latestVersion !== currentVersion,
  };
};

export const performUpdate = async (
  options: TPerformUpdateOptions = {}
): Promise<TPerformUpdateResult> => {
  const packageName = String(packageJson.name);
  const target = options.targetVersion ? `@${options.targetVersion}` : "";
  const registry = normalizeRegistry(options.registry);
  const pm = detectPackageManager();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pm.command, pm.args(`${packageName}${target}`, registry), {
      stdio: "ignore",
    });

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
