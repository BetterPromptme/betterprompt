import type { TPrintOptions } from "./outputs";

export type TSkillType = "image" | "video" | "text";

export type TSearchFilters = {
  type?: TSkillType;
  author?: string;
};

export type TSearchCommandOptions = {
  type?: string;
  author?: string;
};

export type TSearchCommandDependencies = {
  validateQuery: (query: string) => string;
  search: (query: string, filters: TSearchFilters) => Promise<unknown>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
