import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AUTH_STORAGE, SYSTEM_STORAGE } from "../constants";
import type { TBootstrapGlobalDirectoryOptions } from "../types";
import {
  loadOrInitConfig,
  resolveSystemConfigPath,
} from "./config";

const getBootstrapRootDir = (getHomeDir: () => string): string =>
  path.join(getHomeDir(), SYSTEM_STORAGE.configDirName);

const getBootstrapDirectoryPaths = (rootDir: string): string[] => [
  rootDir,
  path.join(rootDir, "skills"),
  path.join(rootDir, "outputs"),
  path.join(rootDir, "logs"),
  path.join(rootDir, "tmp"),
];

const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await mkdir(directoryPath, {
    recursive: true,
    mode: SYSTEM_STORAGE.directoryMode,
  });
  await chmod(directoryPath, SYSTEM_STORAGE.directoryMode).catch(() => {});
};

const ensureAuthConfig = async (authConfigPath: string): Promise<void> => {
  try {
    await access(authConfigPath, constants.F_OK);
    return;
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await writeFile(authConfigPath, "{}\n", {
      flag: "wx",
      mode: AUTH_STORAGE.fileMode,
    });
    await chmod(authConfigPath, AUTH_STORAGE.fileMode).catch(() => {});
  } catch (error) {
    if ((error as { code?: string }).code !== "EEXIST") {
      throw error;
    }
  }
};

export const bootstrapGlobalDirectory = async (
  options: TBootstrapGlobalDirectoryOptions = {}
): Promise<void> => {
  const getHomeDir = options.getHomeDir ?? os.homedir;
  const rootDir = getBootstrapRootDir(getHomeDir);
  const configPath = resolveSystemConfigPath(getHomeDir);
  const authPath = path.join(rootDir, AUTH_STORAGE.fileName);

  for (const directoryPath of getBootstrapDirectoryPaths(rootDir)) {
    await ensureDirectory(directoryPath);
  }

  await loadOrInitConfig({ configPath });
  await ensureAuthConfig(authPath);
};
