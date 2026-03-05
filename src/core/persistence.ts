import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PART_TYPE } from "../enums";
import type {
  THistoryEntry,
  TPersistRunOutputArgs,
  TPersistRunOutputResult,
  TShouldPersistRunOutputArgs,
} from "../types/persistence";
import type { TRunResult } from "../types/run";

const writeJsonFile = async (
  targetPath: string,
  value: unknown
): Promise<void> => {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createOutputDir = (rootDir: string, runId: string): string =>
  path.join(rootDir, "outputs", runId);

export const readPersistedRunOutput = async ({
  rootDir,
  runId,
}: {
  rootDir: string;
  runId: string;
}): Promise<TRunResult> => {
  const outputDir = createOutputDir(rootDir, runId);
  const responsePath = path.join(outputDir, "response.json");

  let raw: string;
  try {
    raw = await readFile(responsePath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(`Run not found in local persistence: ${runId}`);
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TRunResult>;

    if (
      typeof parsed.runId !== "string" ||
      !Array.isArray(parsed.outputs) ||
      typeof parsed.runStatus !== "string"
    ) {
      throw new Error("Invalid persisted run shape.");
    }

    return {
      runId: parsed.runId,
      outputs: parsed.outputs,
      runStatus: parsed.runStatus as TRunResult["runStatus"],
      createdAt:
        typeof parsed.createdAt === "string" && parsed.createdAt.length > 0
          ? parsed.createdAt
          : new Date(0).toISOString(),
      promptVersionId:
        typeof parsed.promptVersionId === "string" &&
        parsed.promptVersionId.length > 0
          ? parsed.promptVersionId
          : "-",
    };
  } catch {
    throw new Error(`Invalid persisted run response: ${responsePath}`);
  }
};

const upsertHistoryEntry = async (
  historyFilePath: string,
  nextEntry: THistoryEntry
): Promise<void> => {
  let raw = "";
  try {
    raw = await readFile(historyFilePath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let updated = false;
  const nextLines: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Partial<THistoryEntry>;
      if (
        typeof parsed.runId === "string" &&
        parsed.runId === nextEntry.runId
      ) {
        if (!updated) {
          nextLines.push(JSON.stringify(nextEntry));
          updated = true;
        }
        continue;
      }
    } catch {
      // Preserve malformed lines to avoid unexpected data loss.
    }

    nextLines.push(line);
  }

  if (!updated) {
    nextLines.push(JSON.stringify(nextEntry));
  }

  await writeFile(historyFilePath, `${nextLines.join("\n")}\n`, "utf8");
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
  const outputDir = createOutputDir(args.scope.rootDir, args.runId);

  await mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeJsonFile(path.join(outputDir, "request.json"), args.request),
    writeJsonFile(path.join(outputDir, "response.json"), args.response),
    writeJsonFile(path.join(outputDir, "metadata.json"), args.metadata),
  ]);

  const historyFilePath = path.join(
    args.scope.rootDir,
    "outputs",
    "history.jsonl"
  );
  const historyEntry: THistoryEntry = {
    runId: args.runId,
    skillVersionId: args.skillVersionId,
    runStatus: args.response.runStatus,
    createdAt:
      typeof args.response.createdAt === "string" &&
      args.response.createdAt.length > 0
        ? args.response.createdAt
        : now.toISOString(),
    persistedAt: now.toISOString(),
    outputDir: path.relative(args.scope.rootDir, outputDir),
  };

  await upsertHistoryEntry(historyFilePath, historyEntry);

  return {
    outputDir,
    historyFilePath,
  };
};
