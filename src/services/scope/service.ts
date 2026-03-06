import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { SYSTEM_STORAGE } from "../../constants";
import type { TCliContext } from "../../types/context";
import type { TResolvedScope, TResolveScope } from "../../types/scope";

const PROJECT_CONFIG_FILE = "betterprompt.json";

const ensureFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await writeFile(filePath, content, {
      flag: "wx",
      mode: SYSTEM_STORAGE.fileMode,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "EEXIST") {
      throw error;
    }
  }
};

const initializeProjectScope = async (projectRootDir: string): Promise<void> => {
  await mkdir(projectRootDir, {
    recursive: true,
    mode: SYSTEM_STORAGE.directoryMode,
  });

  for (const childDirectory of ["skills", "outputs", "logs", "tmp"]) {
    await mkdir(path.join(projectRootDir, childDirectory), {
      recursive: true,
      mode: SYSTEM_STORAGE.directoryMode,
    });
  }

  const projectDir = process.cwd();
  const projectName = path.basename(projectDir);
  const projectConfigPath = path.join(projectDir, PROJECT_CONFIG_FILE);
  const projectConfig = `${JSON.stringify({ name: projectName }, null, 2)}\n`;

  await ensureFile(projectConfigPath, projectConfig);
};

const resolveRootDir = async (ctx: TCliContext): Promise<TResolvedScope> => {
  if (ctx.scope.type === "dir") {
    const resolvedDir = path.resolve(ctx.scope.path);
    await access(resolvedDir, constants.F_OK);
    return {
      type: "dir",
      rootDir: resolvedDir,
    };
  }

  if (ctx.scope.type === "project") {
    const projectRootDir = path.join(process.cwd(), ".betterprompt");
    await initializeProjectScope(projectRootDir);

    return {
      type: "project",
      rootDir: projectRootDir,
    };
  }

  return {
    type: "global",
    rootDir: path.join(homedir(), ".betterprompt"),
  };
};

export const resolveScope: TResolveScope = async (
  ctx: TCliContext
): Promise<TResolvedScope> => resolveRootDir(ctx);
