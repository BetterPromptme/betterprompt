import type { TCliContext } from "./context";

export type TScopeType = "global" | "project" | "dir";

export type TResolvedScope = {
  type: TScopeType;
  rootDir: string;
};

export type TResolveScope = (ctx: TCliContext) => Promise<TResolvedScope>;
