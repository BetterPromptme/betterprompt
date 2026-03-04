import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import packageJson from "../../package.json";
import type {
  TRunUninstallCoreOptions,
  TRunUninstallOptions,
  TRunUninstallResult,
  TUninstallCoreDependencies,
} from "../types/uninstall";

const removeDirectory = async (targetPath: string): Promise<void> => {
  await rm(targetPath, {
    recursive: true,
    force: true,
  });
};

const uninstallPackage = async (
  packageName: string,
  registry?: string
): Promise<void> => {
  const args = ["remove", "-g", packageName];
  if (typeof registry === "string" && registry.trim().length > 0) {
    args.push("--registry", registry.trim());
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn("bun", args, {
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

      reject(new Error(`Uninstall process exited with code ${String(code)}`));
    });
  });
};

const defaultDeps: TUninstallCoreDependencies = {
  removeDirectory,
  uninstallPackage,
};

const resolveDataPath = (): string => join(homedir(), ".betterprompt");

export const runUninstall = async (
  options: TRunUninstallCoreOptions = {}
): Promise<TRunUninstallResult> => {
  const deps = options.deps ?? defaultDeps;
  const uninstallOptions: TRunUninstallOptions = {
    force: options.force === true,
    ...(options.registry !== undefined && { registry: options.registry }),
  };

  if (!uninstallOptions.force) {
    throw new Error("Uninstall confirmation required");
  }

  const removedPath = resolveDataPath();
  await deps.removeDirectory(removedPath);

  const packageName = String(packageJson.name);
  await deps.uninstallPackage(packageName, uninstallOptions.registry);

  return {
    removedPath,
    removedPackage: true,
    confirmed: true,
  };
};
