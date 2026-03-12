import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import { PartType, RunStatus } from "../../enums";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createOutputsCommand } from "./command";

type TOutputsCommandDeps = NonNullable<
  Parameters<typeof createOutputsCommand>[0]
>;
type TListOutputsResult = Awaited<
  ReturnType<TOutputsCommandDeps["listOutputs"]>
>;
type THistoryEntriesResult = Awaited<
  ReturnType<TOutputsCommandDeps["readHistoryEntries"]>
>;

const createDeps = (
  overrides: Partial<TOutputsCommandDeps> = {}
): TOutputsCommandDeps => ({
  resolveScope: mock(async () => ({
    type: "project" as const,
    rootDir: "/tmp/.betterprompt",
  })),
  fetchRun: mock(async () => ({
    runId: "run-123",
    promptVersionId: "skill-version-123",
    runStatus: RunStatus.SUCCEEDED,
    createdAt: "2026-03-04T11:00:00.000Z",
    outputs: [{ type: PartType.TEXT, data: "Generated text output" }],
  })),
  persistRunOutput: mock(async () => ({
    outputDir: "/tmp/.betterprompt/outputs/run-123",
    historyFilePath: "/tmp/.betterprompt/outputs/history.jsonl",
  })),
  listOutputs: mock(async () => [] as TListOutputsResult),
  readHistoryEntries: mock(async () => [] as THistoryEntriesResult),
  ...overrides,
});

const createRoot = (
  deps: ReturnType<typeof createDeps>,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .option("--quiet")
    .option("--verbose")
    .option("--no-color")
    .option("--yes")
    .addCommand(createOutputsCommand(deps, factoryDeps));

  return root;
};

describe("commands/outputs/command", () => {
  it("preserves outputs <run-id> behavior from folder path", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();
    const root = createRoot(deps, factory);

    await root.parseAsync(["outputs", "run-123"], { from: "user" });

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123", {
      remote: false,
      rootDir: "/tmp/.betterprompt",
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Run status: succeeded"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Generated text output"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("preserves outputs list filters and json mode behavior from folder path", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();
    const root = createRoot(deps, factory);

    await root.parseAsync(
      [
        "outputs",
        "list",
        "--remote",
        "--status",
        RunStatus.SUCCEEDED,
        "--limit",
        "10",
        "--since",
        "2026-03-01",
        "--json",
      ],
      { from: "user" }
    );

    expect(deps.listOutputs).toHaveBeenCalledWith({
      remote: true,
      status: RunStatus.SUCCEEDED,
      limit: 10,
      since: "2026-03-01",
    });
    expect(factory.printResult).toHaveBeenCalledWith(
      { rows: [] },
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("keeps nested list/get folder modules present for outputs registration", () => {
    const listCommandPath = path.resolve(import.meta.dir, "list", "command.ts");
    const getCommandPath = path.resolve(import.meta.dir, "get", "command.ts");

    expect(existsSync(listCommandPath)).toBe(true);
    expect(existsSync(getCommandPath)).toBe(true);
  });
});
