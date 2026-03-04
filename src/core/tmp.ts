import { readdir, rm } from "node:fs/promises";
import path from "node:path";

export const cleanupTmpDirectory = async (tmpDirectoryPath: string): Promise<void> => {
  let entries: string[];

  try {
    entries = await readdir(tmpDirectoryPath);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return;
    }

    throw error;
  }

  await Promise.all(
    entries.map((entry) =>
      rm(path.join(tmpDirectoryPath, entry), {
        force: true,
        recursive: true,
      })
    )
  );
};
