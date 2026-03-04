import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { PART_TYPE, RunStatus } from "../enums";
import { getApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import { getRun, validateRunId } from "../core/run";
import type {
  TOutputDownloadResult,
  TOutputFetchResult,
  TOutputHistoryEntry,
  TOutputListFilters,
  TOutputListItem,
  TOutputListRow,
  TOutputsCommandDependencies,
  TOutputsListCommandOptions,
  TOutputsCommandOptions,
} from "../types/outputs";
import type { TRunResult } from "../types/run";

const OUTPUTS_FAILED_PREFIX = "Outputs command failed:";
const OUTPUTS_LIST_STATUS_VALUES: readonly RunStatus[] = [
  RunStatus.Queued,
  RunStatus.Running,
  RunStatus.Succeeded,
  RunStatus.Failed,
];

const resolveOutputPath = (runId: string, outputPath?: string): string => {
  if (outputPath !== undefined && outputPath.trim().length > 0) {
    return outputPath;
  }

  return path.resolve(process.cwd(), "outputs", runId);
};

const isAssetPart = (part: TRunResult["outputs"][number]): boolean =>
  part.type === PART_TYPE.IMAGE || part.type === PART_TYPE.VIDEO;

const downloadAssets = async (
  run: TRunResult,
  outputPath?: string
): Promise<TOutputDownloadResult> => {
  const resolvedOutputPath = resolveOutputPath(run.runId, outputPath);
  await fs.mkdir(resolvedOutputPath, { recursive: true });

  const downloadedFiles = run.outputs
    .filter(isAssetPart)
    .map((asset) => {
      const filename = path.basename(asset.data);
      return path.join(resolvedOutputPath, filename);
    });

  return {
    outputPath: resolvedOutputPath,
    downloadedFiles,
  };
};

const defaultDeps: TOutputsCommandDependencies = {
  fetchRun: async (runId) => {
    const response = await getRun(getApiClient(), runId);
    if (response.data === undefined) {
      throw new Error(`Run not found: ${runId}`);
    }
    return response.data;
  },
  downloadAssets,
  listOutputs: async (filters) => {
    const response = await getApiClient().get<{ data?: TOutputListItem[] }>(
      "/outputs",
      {
        query: filters,
      }
    );
    return response.data ?? [];
  },
  readHistoryEntries: async () => {
    const historyFilePath = path.resolve(process.cwd(), "outputs", "history.jsonl");
    const raw = await fs.readFile(historyFilePath, "utf8");

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line): TOutputHistoryEntry[] => {
        try {
          const parsed = JSON.parse(line) as TOutputHistoryEntry;
          return typeof parsed.runId === "string" ? [parsed] : [];
        } catch {
          return [];
        }
      });
  },
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const formatTextOutputs = (run: TRunResult): string[] =>
  run.outputs
    .filter((part) => part.type === PART_TYPE.TEXT)
    .map((part) => part.data);

const formatDownloadMessage = (downloadResult: TOutputDownloadResult): string =>
  `Downloaded ${downloadResult.downloadedFiles.length} asset(s) to ${downloadResult.outputPath}`;

const toLocalHistoryMap = (entries: TOutputHistoryEntry[]): Map<string, string> => {
  const historyMap = new Map<string, string>();
  entries.forEach((entry) => {
    if (typeof entry.runId !== "string") {
      return;
    }

    if (typeof entry.outputPath === "string" && entry.outputPath.length > 0) {
      historyMap.set(entry.runId, entry.outputPath);
      return;
    }

    if (typeof entry.outputDir === "string" && entry.outputDir.length > 0) {
      const outputPath = path.isAbsolute(entry.outputDir)
        ? entry.outputDir
        : path.resolve(process.cwd(), entry.outputDir);
      historyMap.set(entry.runId, outputPath);
    }
  });

  return historyMap;
};

const mergeLocalHistory = (
  rows: TOutputListItem[],
  historyEntries: TOutputHistoryEntry[]
): TOutputListRow[] => {
  const historyMap = toLocalHistoryMap(historyEntries);
  return rows.map((row) => ({
    ...row,
    localOutputPath: historyMap.get(row.runId),
  }));
};

const padCell = (value: string, width: number): string =>
  value.length >= width ? value : value.padEnd(width, " ");

const formatTable = (rows: TOutputListRow[]): string => {
  const headers = ["RUN ID", "SKILL", "STATUS", "CREATED AT", "LOCAL PATH"];
  const values = rows.map((row) => [
    row.runId,
    row.skillName,
    row.runStatus,
    row.createdAt,
    row.localOutputPath ?? "-",
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...values.map((row) => row[index]!.length))
  );

  const headerLine = headers
    .map((header, index) => padCell(header, widths[index]!))
    .join("  ");
  const bodyLines = values.map((valueRow) =>
    valueRow.map((value, index) => padCell(value, widths[index]!)).join("  ")
  );

  return [headerLine, ...bodyLines].join("\n");
};

const parseListFilters = (
  opts: TOutputsListCommandOptions
): TOutputListFilters => {
  const filters: TOutputListFilters = {};

  if (opts.skill !== undefined) {
    filters.skill = opts.skill;
  }
  if (opts.since !== undefined) {
    filters.since = opts.since;
  }
  if (opts.status !== undefined) {
    if (!OUTPUTS_LIST_STATUS_VALUES.includes(opts.status)) {
      throw new Error(
        `Invalid output status "${opts.status}". Expected one of: ${OUTPUTS_LIST_STATUS_VALUES.join(
          ", "
        )}.`
      );
    }
    filters.status = opts.status;
  }
  if (opts.limit !== undefined) {
    const parsed = Number.parseInt(opts.limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Invalid limit value. --limit must be a positive integer.");
    }
    filters.limit = parsed;
  }

  return filters;
};

export const createOutputsCommand = (
  deps: TOutputsCommandDependencies = defaultDeps
): Command => {
  const command = new Command("outputs")
    .description("Fetch output artifacts for a run")
    .usage("[options] <run-id>")
    .argument("<run-id>", "Run ID to fetch")
    .option("--out <path>", "Output directory for downloaded assets")
    .option("--json", "Render output as JSON")
    .action(
      async (runId: string, opts: TOutputsCommandOptions, command: Command) => {
        try {
          const ctx = getCommandContext(command);
          validateRunId(runId);

          const run = await runTaskWithSpinner({
            message: "Fetching output run...",
            createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.fetchRun(runId),
          });
          const downloaded = await deps.downloadAssets(run, opts.out);
          const result: TOutputFetchResult = {
            ...run,
            ...downloaded,
          };

          if (ctx.outputFormat === "json") {
            deps.printResult(result, ctx);
            return;
          }

          const textOutputs = formatTextOutputs(run);
          if (textOutputs.length > 0) {
            textOutputs.forEach((output) => {
              deps.printResult(output, ctx);
            });
            return;
          }

          deps.printResult(formatDownloadMessage(downloaded), ctx);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          deps.error(`${logSymbols.error} ${OUTPUTS_FAILED_PREFIX} ${errorMessage}`);
          deps.setExitCode(1);
        }
      }
    );

  command
    .command("list")
    .description("List output runs")
    .option("--skill <skill-slug>", "Filter by skill name")
    .option(
      "--status <status>",
      "Filter by status (queued|running|succeeded|failed)"
    )
    .option("--limit <n>", "Limit the number of rows")
    .option("--since <date>", "Only include rows created at or after this date")
    .option("--json", "Render output as JSON")
    .action(async (opts: TOutputsListCommandOptions, listCommand: Command) => {
      try {
        const ctx = getCommandContext(listCommand);
        const filters = parseListFilters(opts);
        const [rows, historyEntries] = await Promise.all([
          runTaskWithSpinner({
            message: "Loading outputs list...",
            createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.listOutputs(filters),
          }),
          deps.readHistoryEntries().catch(() => []),
        ]);
        const mergedRows = mergeLocalHistory(rows, historyEntries);

        if (ctx.outputFormat === "json") {
          deps.printResult({ rows: mergedRows }, ctx);
          return;
        }

        if (mergedRows.length === 0) {
          deps.printResult(`${logSymbols.warning} No outputs found.`, ctx);
          return;
        }

        deps.printResult(formatTable(mergedRows), ctx);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${OUTPUTS_FAILED_PREFIX} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

  return command;
};

export const outputsCommand = createOutputsCommand();
