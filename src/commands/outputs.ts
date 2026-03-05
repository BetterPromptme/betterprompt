import { Command } from "commander";
import logSymbols from "log-symbols";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { getApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import { persistRunOutput, readPersistedRunOutput } from "../core/persistence";
import { getRun, validateRunId } from "../core/run";
import { resolveScope } from "../core/scope";
import { RunStatus } from "../enums";
import { TApiResponse } from "../types";
import type {
  TOutputHistoryEntry,
  TOutputListFilters,
  TOutputListRow,
  TOutputsCommandDependencies,
  TOutputsCommandOptions,
  TOutputsListCommandOptions,
} from "../types/outputs";
import type { TRunResult } from "../types/run";

const OUTPUTS_FAILED_PREFIX = "Outputs command failed:";
const OUTPUTS_REMOTE_HINT = "Hint: retry with --remote to fetch from API.";
const OUTPUTS_EMPTY_MESSAGE_PREFIX = "No outputs found for run";
const OUTPUTS_LIST_STATUS_VALUES: readonly RunStatus[] = [
  RunStatus.Queued,
  RunStatus.Running,
  RunStatus.Succeeded,
  RunStatus.Failed,
];

export const buildOutputsListQuery = (
  filters: TOutputListFilters
): Record<string, string | number> => {
  const query: Record<string, string | number> = {};

  // TODO: support in v2
  // if (filters.status !== undefined) {
  //   query.status = filters.status;
  // }

  if (filters.limit !== undefined) {
    query.limit = filters.limit;
  }

  return query;
};

const defaultDeps: TOutputsCommandDependencies = {
  resolveScope,
  fetchRun: async (runId, opts) => {
    if (opts?.remote === true) {
      const response = await getRun(getApiClient(), runId, opts);
      if (response.data === undefined) {
        throw new Error(`Run not found: ${runId}`);
      }
      return response.data;
    }

    if (typeof opts?.rootDir !== "string" || opts.rootDir.length === 0) {
      throw new Error("Missing local outputs directory.");
    }

    return readPersistedRunOutput({
      rootDir: opts.rootDir,
      runId,
    });
  },
  persistRunOutput,
  listOutputs: async (filters) => {
    const query = buildOutputsListQuery(filters);
    const response = await getApiClient().get<
      TApiResponse<{
        rows: TRunResult[];
      }>
    >("/runs", {
      query,
    });
    return (
      response.data?.rows.map((row) => ({
        runId: row.runId,
        skillVersionId: row.promptVersionId,
        runStatus: row.runStatus,
        createdAt: row.createdAt,
      })) ?? []
    );
  },
  readHistoryEntries: async (rootDir) => {
    const historyFilePath = path.resolve(rootDir, "outputs", "history.jsonl");
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

const formatDisplayOutputs = (run: TRunResult): string[] =>
  run.outputs.map((part) => part.data);

const normalizeRunStatus = (
  value: string | undefined
): RunStatus | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return OUTPUTS_LIST_STATUS_VALUES.includes(normalized as RunStatus)
    ? (normalized as RunStatus)
    : undefined;
};

const buildLocalOutputPath = (
  entry: TOutputHistoryEntry,
  rootDir: string
): string | undefined => {
  if (typeof entry.outputPath === "string" && entry.outputPath.length > 0) {
    return entry.outputPath;
  }

  if (typeof entry.outputDir === "string" && entry.outputDir.length > 0) {
    return path.isAbsolute(entry.outputDir)
      ? entry.outputDir
      : path.resolve(rootDir, entry.outputDir);
  }

  return undefined;
};

const localHistoryEntryToRow = (
  entry: TOutputHistoryEntry,
  rootDir: string
): TOutputListRow | undefined => {
  if (typeof entry.runId !== "string") {
    return undefined;
  }

  const runStatus = normalizeRunStatus(entry.runStatus);
  if (runStatus === undefined) {
    return undefined;
  }

  return {
    runId: entry.runId,
    skillVersionId:
      typeof entry.skillVersionId === "string" &&
      entry.skillVersionId.length > 0
        ? entry.skillVersionId
        : "-",
    runStatus,
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt.length > 0
        ? entry.createdAt
        : typeof entry.persistedAt === "string" && entry.persistedAt.length > 0
          ? entry.persistedAt
          : "-",
    localOutputPath: buildLocalOutputPath(entry, rootDir),
  };
};

const parseTimestamp = (value: string): number | undefined => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const filterLocalRows = (
  rows: TOutputListRow[],
  filters: TOutputListFilters
): TOutputListRow[] => {
  const sinceTimestamp =
    typeof filters.since === "string"
      ? parseTimestamp(filters.since)
      : undefined;

  const filtered = rows.filter((row) => {
    if (filters.status !== undefined && row.runStatus !== filters.status) {
      return false;
    }

    if (sinceTimestamp === undefined) {
      return true;
    }

    const rowTimestamp = parseTimestamp(row.createdAt);
    return rowTimestamp !== undefined && rowTimestamp >= sinceTimestamp;
  });

  filtered.sort((a, b) => {
    const aTimestamp = parseTimestamp(a.createdAt) ?? 0;
    const bTimestamp = parseTimestamp(b.createdAt) ?? 0;
    return bTimestamp - aTimestamp;
  });

  if (filters.limit !== undefined) {
    return filtered.slice(0, filters.limit);
  }

  return filtered;
};

const listLocalOutputs = async (
  deps: TOutputsCommandDependencies,
  filters: TOutputListFilters,
  rootDir: string
): Promise<TOutputListRow[]> => {
  const historyEntries = await deps.readHistoryEntries(rootDir).catch(() => []);
  const rows = historyEntries
    .map((entry) => localHistoryEntryToRow(entry, rootDir))
    .flatMap((row): TOutputListRow[] => (row === undefined ? [] : [row]));
  return filterLocalRows(rows, filters);
};

const listRemoteOutputs = async (
  deps: TOutputsCommandDependencies,
  filters: TOutputListFilters
): Promise<TOutputListRow[]> => {
  const rows = await deps.listOutputs(filters);
  return rows.map((row) => ({
    ...row,
    localOutputPath: undefined,
  }));
};

const getOutputListData = async (
  deps: TOutputsCommandDependencies,
  filters: TOutputListFilters,
  rootDir: string
): Promise<TOutputListRow[]> => {
  if (filters.remote === true) {
    return listRemoteOutputs(deps, filters);
  }

  return listLocalOutputs(deps, filters, rootDir);
};

const padCell = (value: string, width: number): string =>
  value.length >= width ? value : value.padEnd(width, " ");

const formatTable = (rows: TOutputListRow[]): string => {
  const headers = ["RUN ID", "SKILL VERSION ID", "STATUS", "CREATED AT"];
  const values = rows.map((row) => [
    row.runId,
    row.skillVersionId,
    row.runStatus,
    row.createdAt,
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
      throw new Error(
        "Invalid limit value. --limit must be a positive integer."
      );
    }
    filters.limit = parsed;
  }
  if (opts.remote === true) {
    filters.remote = true;
  }

  return filters;
};

export const createOutputsCommand = (
  deps: TOutputsCommandDependencies = defaultDeps
): Command => {
  const command = new Command("outputs")
    .description("Fetch outputs from a run")
    .usage("[options] <run-id>")
    .argument("<run-id>", "Run ID to fetch")
    .option("--sync", "Fetch remote outputs and sync local artifacts")
    .option("--remote", "Use remote outputs scope")
    .option("--json", "Render output as JSON")
    .action(
      async (runId: string, opts: TOutputsCommandOptions, command: Command) => {
        let shouldUseRemote = false;
        try {
          const ctx = getCommandContext(command);
          validateRunId(runId);
          const scope = await deps.resolveScope(ctx);
          shouldUseRemote = opts.remote === true || opts.sync === true;

          const run = await runTaskWithSpinner({
            message: "Fetching output run...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () =>
              deps.fetchRun(runId, {
                remote: shouldUseRemote,
                rootDir: scope.rootDir,
              }),
          });

          if (opts.sync === true) {
            await deps.persistRunOutput({
              scope,
              runId: run.runId,
              skillVersionId:
                typeof run.promptVersionId === "string" &&
                run.promptVersionId.length > 0
                  ? run.promptVersionId
                  : "-",
              request: {
                runId,
                remote: shouldUseRemote,
              },
              response: run,
              metadata: {
                runStatus: run.runStatus,
                syncedAt: new Date().toISOString(),
              },
            });
          }

          if (ctx.outputFormat === "json") {
            deps.printResult(run, ctx);
            return;
          }

          const displayOutputs = formatDisplayOutputs(run);
          if (displayOutputs.length > 0) {
            displayOutputs.forEach((output) => {
              deps.printResult(output, ctx);
            });
            return;
          }

          deps.printResult(
            `${logSymbols.warning} ${OUTPUTS_EMPTY_MESSAGE_PREFIX} ${run.runId}.`,
            ctx
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorWithHint =
            shouldUseRemote === false
              ? `${errorMessage}\n${OUTPUTS_REMOTE_HINT}`
              : errorMessage;
          deps.error(
            `${logSymbols.error} ${OUTPUTS_FAILED_PREFIX} ${errorWithHint}`
          );
          deps.setExitCode(1);
        }
      }
    );

  command
    .command("list")
    .description("List output runs")
    .option("--remote", "Use remote outputs scope")
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
        const scope = await deps.resolveScope(ctx);
        const filters = parseListFilters({
          ...opts,
          remote:
            opts.remote === true ||
            listCommand.parent?.opts<{ remote?: boolean }>().remote === true,
        });
        const rows = await runTaskWithSpinner({
          message: "Loading outputs list...",
          createSpinner: (message) =>
            ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () => getOutputListData(deps, filters, scope.rootDir),
        });

        if (ctx.outputFormat === "json") {
          deps.printResult({ rows }, ctx);
          return;
        }

        if (rows.length === 0) {
          deps.printResult(`${logSymbols.warning} No outputs found.`, ctx);
          return;
        }

        deps.printResult(formatTable(rows), ctx);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(
          `${logSymbols.error} ${OUTPUTS_FAILED_PREFIX} ${errorMessage}`
        );
        deps.setExitCode(1);
      }
    });

  return command;
};

export const outputsCommand = createOutputsCommand();
