import { SEARCH_CONFIG, SEARCH_MESSAGES, SKILLS_MESSAGES } from "../constants";
import { TApiResponse } from "../types";
import type { ApiClient } from "./api";

type TSkillSearchApi = Pick<ApiClient, "get">;

export type TSkillSearchRow = {
  skillId: string; // use for get details of the skill
  title: string;
  description: string;
  name: string;
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
  query: string
): Promise<TSearchSkillsResponse["rows"]> => {
  const normalizedQuery = validateSearchQuery(query);

  const response = await apiClient.get<TApiResponse<TSearchSkillsResponse>>(
    "/skills",
    {
      query: {
        q: normalizedQuery,
      },
    }
  );

  if (response.status === "SUCCESS" && response.data) {
    return response.data.rows;
  }

  throw new Error(response.message);
};

export const getSkillById = async (
  apiClient: TSkillSearchApi,
  skillId: string
): Promise<TSkillDetail> => {
  if (!skillId || !skillId.trim()) {
    throw new Error(SKILLS_MESSAGES.invalidSkillIdError);
  }

  const response = await apiClient.get<TApiResponse<TSkillDetail>>(
    `/skills/${skillId.trim()}`
  );

  if (response.status === "SUCCESS" && response.data) {
    return response.data;
  }

  throw new Error(response.message);
};
