import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  TResetCoreDependencies,
  TRunResetCoreOptions,
  TRunResetResult,
} from "../types/reset";

const removeDirectory = async (targetPath: string): Promise<void> => {
  await rm(targetPath, {
    recursive: true,
    force: true,
  });
};

const defaultDeps: TResetCoreDependencies = {
  removeDirectory,
};

const resolveDataPath = (): string => join(homedir(), ".betterprompt");

export const runReset = async (
  options: TRunResetCoreOptions = {}
): Promise<TRunResetResult> => {
  const deps = options.deps ?? defaultDeps;
  const force = options.force === true;

  if (!force) {
    throw new Error("Reset confirmation required");
  }

  const removedPath = resolveDataPath();
  await deps.removeDirectory(removedPath);

  return {
    removedPath,
    confirmed: true,
  };
};
