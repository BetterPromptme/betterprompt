import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { TCliContext } from "../types/context";
import type { TResolvedScope, TResolveScope } from "../types/scope";

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
    return {
      type: "project",
      rootDir: path.join(process.cwd(), ".betterprompt"),
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
