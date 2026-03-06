import { SEARCH_CONFIG, SEARCH_MESSAGES, SKILLS_MESSAGES } from "../../constants";
import type { TApiResponse } from "../../types/api";
import type { TSearchFilters } from "../../types/search";
import type { TSkillInfoOptions } from "../../types/skills";
import { getApiClient } from "../api/client";
import { printResult } from "../output/service";
import {
  installSkill as installSkillService,
  listSkills as listSkillsService,
  uninstallSkill as uninstallSkillService,
  updateAllSkills as updateAllSkillsService,
  updateSkill as updateSkillService,
} from "./installer";
import {
  TSkillDetail,
  TSkillSearchApi,
  TSkillSearchRow,
} from "./types";
import type { TSkillCommandDependencies } from "./types";

export type { TSkillDetail, TSkillSearchRow };

export const normalizeSearchQuery = (query: string): string => query.trim();

export const validateSearchQuery = (
  query: string,
  minLength = SEARCH_CONFIG.minQueryLength
): string => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length < minLength) {
    throw new Error(SEARCH_MESSAGES.invalidQueryLengthError(minLength));
  }

  return normalizedQuery;
};

export const searchSkills = async (
  apiClient: TSkillSearchApi,
  query: string,
  filters: TSearchFilters = {}
): Promise<TSkillSearchRow[]> => {
  const normalizedQuery = validateSearchQuery(query);
  const queryParams: Record<string, string | number | boolean> = {
    q: normalizedQuery,
  };

  if (filters.type !== undefined) {
    queryParams.type = filters.type;
  }

  if (filters.author !== undefined) {
    queryParams.author = filters.author;
  }

  const response = await apiClient.get<TApiResponse<{ rows: TSkillSearchRow[] }>>(
    "/skills",
    {
      query: queryParams,
    }
  );

  if (response.status === "SUCCESS" && response.data) {
    return response.data.rows;
  }

  throw new Error(response.message);
};

export const getSkillByName = async (
  apiClient: TSkillSearchApi,
  skillName: string,
  options?: TSkillInfoOptions
): Promise<TSkillDetail> => {
  if (!skillName || !skillName.trim()) {
    throw new Error(SKILLS_MESSAGES.invalidSkillNameError);
  }

  const query: Record<string, string | boolean> = {};
  if (options?.version !== undefined) {
    query.version = options.version;
  }
  if (options?.examples !== undefined) {
    query.examples = options.examples;
  }
  if (options?.schema !== undefined) {
    query.schema = options.schema;
  }
  if (options?.pricing !== undefined) {
    query.pricing = options.pricing;
  }

  const response =
    Object.keys(query).length > 0
      ? await apiClient.get<TApiResponse<TSkillDetail>>(
          `/skills/${skillName.trim()}`,
          {
            query,
          }
        )
      : await apiClient.get<TApiResponse<TSkillDetail>>(
          `/skills/${skillName.trim()}`
        );

  if (response.status === "SUCCESS" && response.data) {
    return response.data;
  }

  throw new Error(response.message);
};

export const createDefaultSkillCommandDependencies = (): TSkillCommandDependencies => ({
  getSkill: (skillName) => getSkillByName(getApiClient(), skillName),
  installSkill: installSkillService,
  uninstallSkill: uninstallSkillService,
  listSkills: listSkillsService,
  updateSkill: updateSkillService,
  updateAllSkills: updateAllSkillsService,
  validateQuery: validateSearchQuery,
  search: (query, filters) => searchSkills(getApiClient(), query, filters),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => {
    console.error(message);
  },
  setExitCode: (code) => {
    process.exitCode = code;
  },
});
