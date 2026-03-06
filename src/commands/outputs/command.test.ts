import { describe, expect, it, mock } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { PART_TYPE, RunStatus } from "../../enums";
import { createOutputsCommand } from "./command";

type TOutputsCommandDeps = NonNullable<Parameters<typeof createOutputsCommand>[0]>;
type TListOutputsResult = Awaited<ReturnType<TOutputsCommandDeps["listOutputs"]>>;
type THistoryEntriesResult = Awaited<
  ReturnType<TOutputsCommandDeps["readHistoryEntries"]>
>;

const createDeps = (overrides: Partial<TOutputsCommandDeps> = {}): TOutputsCommandDeps =>
  ({
    resolveScope: mock(async () => ({
      type: "project" as const,
      rootDir: "/tmp/.betterprompt",
    })),
    fetchRun: mock(async () => ({
      runId: "run-123",
      promptVersionId: "skill-version-123",
      runStatus: RunStatus.Succeeded,
      createdAt: "2026-03-04T11:00:00.000Z",
      outputs: [{ type: PART_TYPE.TEXT, data: "Generated text output" }],
    })),
    persistRunOutput: mock(async () => ({
      outputDir: "/tmp/.betterprompt/outputs/run-123",
      historyFilePath: "/tmp/.betterprompt/outputs/history.jsonl",
    })),
    listOutputs: mock(async () => [] as TListOutputsResult),
    readHistoryEntries: mock(async () => [] as THistoryEntriesResult),
    printResult: mock(() => {}),
    error: mock(() => {}),
    setExitCode: mock(() => {}),
    ...overrides,
  });

const createRoot = (deps: ReturnType<typeof createDeps>) => {
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
    .addCommand(createOutputsCommand(deps));

  return root;
};

describe("commands/outputs/command", () => {
  it("preserves outputs <run-id> behavior from folder path", async () => {
    const deps = createDeps();
    const root = createRoot(deps);

    await root.parseAsync(["outputs", "run-123"], { from: "user" });

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123", {
      remote: false,
      rootDir: "/tmp/.betterprompt",
    });
    expect(deps.printResult).toHaveBeenNthCalledWith(
      1,
      "Run status: succeeded",
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(deps.printResult).toHaveBeenNthCalledWith(
      2,
      "Generated text output",
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("preserves outputs list filters and json mode behavior from folder path", async () => {
    const deps = createDeps();
    const root = createRoot(deps);

    await root.parseAsync(
      [
        "outputs",
        "list",
        "--remote",
        "--status",
        RunStatus.Succeeded,
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
      status: RunStatus.Succeeded,
      limit: 10,
      since: "2026-03-01",
    });
    expect(deps.printResult).toHaveBeenCalledWith(
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
