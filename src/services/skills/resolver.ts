import { readFile } from "node:fs/promises";
import path from "node:path";

import { getApiClient } from "../api/client";
import { getSkillByName } from "./service";
import type { TSkillSearchApi } from "./types";

const resolveFromLocal = async (
  slug: string,
  rootDir: string
): Promise<string | undefined> => {
  const manifestPath = path.join(rootDir, "skills", slug, "manifest.json");

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  const manifest = JSON.parse(raw) as { latestPromptVersionId?: string };

  if (
    typeof manifest.latestPromptVersionId === "string" &&
    manifest.latestPromptVersionId.length > 0
  ) {
    return manifest.latestPromptVersionId;
  }

  return undefined;
};

const resolveFromApi = async (
  apiClient: TSkillSearchApi,
  slug: string
): Promise<string> => {
  const skill = await getSkillByName(apiClient, slug);
  return skill.latestPromptVersionId;
};

export const resolvePromptVersionId = async (
  slug: string,
  rootDir: string,
  apiClient: TSkillSearchApi = getApiClient()
): Promise<string> => {
  const local = await resolveFromLocal(slug, rootDir);
  if (local !== undefined) {
    return local;
  }

  return resolveFromApi(apiClient, slug);
};
