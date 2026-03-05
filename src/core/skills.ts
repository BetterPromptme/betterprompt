import { SEARCH_CONFIG, SEARCH_MESSAGES, SKILLS_MESSAGES } from "../constants";
import { TApiResponse } from "../types";
import type { TSearchFilters } from "../types/search";
import type { TSkillInfoOptions } from "../types/skills";
import { TInputMetadata } from "../utils/schema";
import type { ApiClient } from "./api";

type TSkillSearchApi = Pick<ApiClient, "get">;

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
  name: string; // use for get details of the skill
  inputMetadata: TInputMetadata;
};

export type TSearchSkillsResponse = {
  rows: TSkillSearchRow[];
};

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

export type TSkillDetail = TSkillSearchRow & { skillmd: string };

export const searchSkills = async (
  apiClient: TSkillSearchApi,
  query: string,
  filters: TSearchFilters = {}
): Promise<TSearchSkillsResponse["rows"]> => {
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

  const response = await apiClient.get<TApiResponse<TSearchSkillsResponse>>(
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
