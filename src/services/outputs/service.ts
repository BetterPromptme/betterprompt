import fs from "node:fs/promises";
import path from "node:path";
import { getApiClient } from "../api/client";
import { validateRunId } from "../run/service";
import {
  persistRunOutput,
  readPersistedRunOutput,
} from "../persistence/service";
import { getRun } from "../run/service";
import { resolveScope } from "../scope/service";
import { RunStatus } from "../../enums";
import { OUTPUTS_MESSAGES } from "../../constants";
import type { TApiResponse } from "../../types/api";
import type {
  TOutputHistoryEntry,
  TOutputListFilters,
  TOutputListRow,
  TOutputsCommandDependencies,
  TOutputsCommandOptions,
  TOutputsListCommandOptions,
} from "../../types/outputs";
import type { TRunResult } from "../../types/run";
import type { TCliContext } from "../../types/context";

const OUTPUTS_LIST_STATUS_VALUES: readonly RunStatus[] = [
  RunStatus.Queued,
  RunStatus.Running,
  RunStatus.Succeeded,
  RunStatus.Failed,
];

export const parseSinceToUnixMs = (value: string): number => {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(OUTPUTS_MESSAGES.invalidSince);
  }

  return parsed;
};

export const buildOutputsListQuery = (
  filters: TOutputListFilters
): Record<string, string | number> => {
  const query: Record<string, string | number> = {};

  if (filters.since !== undefined) {
    query.since = parseSinceToUnixMs(filters.since);
  }

  if (filters.status !== undefined) {
    query.status = filters.status;
  }

  if (filters.limit !== undefined) {
    query.limit = filters.limit;
  }

  return query;
};

export const createDefaultOutputsCommandDependencies =
  (): TOutputsCommandDependencies => ({
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
  });

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

export const formatTable = (rows: TOutputListRow[]): string => {
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

export const fetchOutputRun = async (
  deps: TOutputsCommandDependencies,
  runId: string,
  opts: TOutputsCommandOptions,
  ctx: TCliContext
): Promise<TRunResult> => {
  validateRunId(runId);
  const scope = await deps.resolveScope(ctx);
  const shouldUseRemote = opts.remote === true || opts.sync === true;

  let run: TRunResult;
  try {
    run = await deps.fetchRun(runId, {
      remote: shouldUseRemote,
      rootDir: scope.rootDir,
    });
  } catch (error) {
    if (!shouldUseRemote) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}\n${OUTPUTS_MESSAGES.remoteHint}`);
    }
    throw error;
  }

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

  return run;
};

export const fetchOutputsList = async (
  deps: TOutputsCommandDependencies,
  opts: TOutputsListCommandOptions,
  ctx: TCliContext
): Promise<{ rows: TOutputListRow[] }> => {
  const scope = await deps.resolveScope(ctx);
  const filters = parseListFilters(opts);
  const rows = await getOutputListData(deps, filters, scope.rootDir);
  return { rows };
};
