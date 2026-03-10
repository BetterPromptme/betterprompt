import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RESOURCES_STORAGE, SYSTEM_STORAGE } from "../../constants";
import type { TApiResponse } from "../../types/api";
import type { TResourcesData } from "../../types/resources";

type TResourcesApi = {
  get: (path: string) => Promise<TApiResponse<TResourcesData>>;
};

export const resolveResourcesFilePath = (
  getHomeDir: () => string = os.homedir
): string =>
  path.join(
    getHomeDir(),
    SYSTEM_STORAGE.configDirName,
    RESOURCES_STORAGE.fileName
  );

export const fetchResources = async (
  apiClient: TResourcesApi
): Promise<TResourcesData> => {
  const response = await apiClient.get("/resources");

  if (response.status === "SUCCESS" && response.data) {
    return response.data;
  }

  throw new Error(response.message ?? "Failed to fetch resources.");
};

export const loadLocalResources = async (
  filePath: string = resolveResourcesFilePath()
): Promise<TResourcesData | null> => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as TResourcesData;
  } catch (error) {
    if (
      (error as { code?: string }).code === "ENOENT" ||
      error instanceof SyntaxError
    ) {
      return null;
    }
    throw error;
  }
};

export const saveLocalResources = async (
  data: TResourcesData,
  filePath: string = resolveResourcesFilePath()
): Promise<void> => {
  await mkdir(path.dirname(filePath), {
    recursive: true,
    mode: SYSTEM_STORAGE.directoryMode,
  });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, {
    mode: SYSTEM_STORAGE.fileMode,
  });
};
