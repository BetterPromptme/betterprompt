import { SEARCH_CONFIG, SEARCH_MESSAGES } from "../constants";
import type { ApiClient } from "./api";

type TSkillSearchApi = Pick<ApiClient, "get">;

export type TSkillSearchRow = {
  promptId: string;
  title: string;
  description: string;
  name: string; // use for get details of the skill
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

export const searchSkills = async (
  apiClient: TSkillSearchApi,
  query: string
): Promise<TSearchSkillsResponse> => {
  const normalizedQuery = validateSearchQuery(query);

  return apiClient.get<TSearchSkillsResponse>("/skills", {
    query: {
      q: normalizedQuery,
    },
  });
};
