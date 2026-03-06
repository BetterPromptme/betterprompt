import type { ApiClient } from "../api/client";
import type { TSkillSummary, TUpdateSkillResult } from "../../types/installer";
import type { TPrintOptions } from "../../types/outputs";
import type { TSearchFilters } from "../../types/search";
import type {
  TSkillInstallOptions,
  TSkillListOptions,
  TSkillUninstallOptions,
  TSkillUpdateOptions,
} from "../../types/skills";
import type { TInputMetadata } from "../../utils/schema";

export type TSkillSearchApi = Pick<ApiClient, "get">;

export type TSkillSearchRow = {
  author: string | null;
  description: string | null;
  sample: {
    inputs: unknown;
    outputs: unknown;
  };
  skillId: string;
  skillVersionId: string;
  title: string;
  name: string;
  inputMetadata: TInputMetadata;
};

export type TSkillDetail = TSkillSearchRow & { skillmd: string };

export type TSkillCommandDependencies = {
  getSkill: (skillName: string) => Promise<unknown>;
  installSkill: (
    skillName: string,
    options: TSkillInstallOptions
  ) => Promise<unknown>;
  uninstallSkill: (
    skillName: string,
    options: TSkillUninstallOptions
  ) => Promise<unknown>;
  listSkills: (options: TSkillListOptions) => Promise<TSkillSummary[]>;
  updateSkill: (
    skillName: string,
    options: TSkillUpdateOptions
  ) => Promise<TUpdateSkillResult>;
  updateAllSkills: (
    options: TSkillUpdateOptions
  ) => Promise<TUpdateSkillResult[]>;
  validateQuery: (query: string) => string;
  search: (query: string, filters: TSearchFilters) => Promise<unknown>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
