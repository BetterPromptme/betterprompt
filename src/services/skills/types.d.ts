import type { TSkillSummary, TUpdateSkillResult } from "../../types/installer";
import type { TSearchFilters } from "../../types/search";
import type {
  TSkillInstallOptions,
  TSkillListOptions,
  TSkillUninstallOptions,
  TSkillUpdateOptions,
} from "../../types/skills";
import type { TInputMetadata } from "../../utils/schema";
import type { ApiClient } from "../api/client";

export type TSkillSearchApi = Pick<ApiClient, "get">;

export type TSkillSearchRow = {
  author: string | null;
  description: string | null;
  sample: {
    inputs: unknown;
    outputs: unknown;
  };
  skillId: string;
  latestPromptVersionId: string;
  metadata: { skillmdUrl: string };
  title: string;
  name: string;
};

export type TSkillDetail = TSkillSearchRow & {
  inputMetadata: TInputMetadata;
};

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
};
