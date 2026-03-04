import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PART_TYPE } from "../enums";
import type {
  THistoryEntry,
  TPersistRunOutputArgs,
  TPersistRunOutputResult,
  TShouldPersistRunOutputArgs,
} from "../types/persistence";

const toTwoDigits = (value: number): string => value.toString().padStart(2, "0");

const writeJsonFile = async (targetPath: string, value: unknown): Promise<void> => {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createOutputDir = (rootDir: string, now: Date, runId: string): string => {
  const year = String(now.getUTCFullYear());
  const month = toTwoDigits(now.getUTCMonth() + 1);
  return path.join(rootDir, "outputs", year, month, `output_${runId}`);
};

export const shouldPersistRunOutput = ({
  saveRun,
  outputs,
}: TShouldPersistRunOutputArgs): boolean => {
  if (saveRun === true) {
    return true;
  }

  return outputs.some((output) => output.type !== PART_TYPE.TEXT);
};

export const persistRunOutput = async (
  args: TPersistRunOutputArgs
): Promise<TPersistRunOutputResult> => {
  const now = args.now ?? new Date();
  const outputDir = createOutputDir(args.scope.rootDir, now, args.runId);

  await mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeJsonFile(path.join(outputDir, "request.json"), args.request),
    writeJsonFile(path.join(outputDir, "response.json"), args.response),
    writeJsonFile(path.join(outputDir, "metadata.json"), args.metadata),
  ]);

  if ((args.assets?.length ?? 0) > 0) {
    const assetsDir = path.join(outputDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    await Promise.all(
      args.assets!.map((asset) =>
        writeFile(path.join(assetsDir, asset.fileName), asset.content, "utf8")
      )
    );
  }

  const historyFilePath = path.join(args.scope.rootDir, "outputs", "history.jsonl");
  const historyEntry: THistoryEntry = {
    runId: args.runId,
    skillName: args.skillName,
    runStatus: args.response.runStatus,
    persistedAt: now.toISOString(),
    outputDir: path.relative(args.scope.rootDir, outputDir),
  };

  await appendFile(historyFilePath, `${JSON.stringify(historyEntry)}\n`, "utf8");

  return {
    outputDir,
    historyFilePath,
  };
};
