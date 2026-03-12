import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { PART_TYPE, RunStatus } from "../../enums";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { buildOutputsListQuery, createOutputsCommand } from "./command";

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
      outputs: [
        {
          type: PART_TYPE.TEXT,
          data: "Generated text output",
        },
      ],
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

const runOutputs = async (
  args: string[],
  deps: ReturnType<typeof createDeps>,
  factory: Partial<TCommandFactoryDeps>
) => {
  const root = createRoot(deps, factory);
  await root.parseAsync(["outputs", ...args], { from: "user" });
};

describe("outputs command", () => {
  it("fetches run result by ID from local persistence by default", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runOutputs(["run-123"], deps, factory);

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123", {
      remote: false,
      rootDir: "/tmp/.betterprompt",
    });
  });

  it("prints text output to stdout in text mode", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-text",
        promptVersionId: "skill-version-text",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
        outputs: [
          {
            type: PART_TYPE.TEXT,
            data: "A plain text artifact",
          },
        ],
      })),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-text"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Run status: succeeded"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("A plain text artifact"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("prints feedback when run has no outputs", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-empty",
        promptVersionId: "skill-version-empty",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
        outputs: [],
      })),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-empty"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("No outputs found for run run-empty"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("persists output artifacts when --sync is provided", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-image",
        promptVersionId: "skill-version-789",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
        outputs: [
          {
            type: PART_TYPE.IMAGE,
            data: "outputs/run-image/image.png",
          },
        ],
      })),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-image", "--sync"], deps, factory);

    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: "project", rootDir: "/tmp/.betterprompt" },
        runId: "run-image",
        skillVersionId: "skill-version-789",
      })
    );
    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.not.objectContaining({
        assets: expect.anything(),
      })
    );
  });

  it("does not persist output artifacts when --sync is not provided", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-video",
        promptVersionId: "skill-version-video",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
        outputs: [
          {
            type: PART_TYPE.VIDEO,
            data: "outputs/run-video/video.mp4",
          },
        ],
      })),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-video"], deps, factory);

    expect(deps.persistRunOutput).not.toHaveBeenCalled();
  });

  it("returns structured metadata in --json mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runOutputs(["run-123", "--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (factory.printResult as ReturnType<typeof mock>).mock.calls[0] as [
      Record<string, unknown>,
      { outputFormat: string },
    ];

    expect(ctx.outputFormat).toBe("json");
    expect(result).toMatchObject({
      runId: "run-123",
      runStatus: RunStatus.Succeeded,
    });
  });

  it("passes --remote to fetch run", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runOutputs(["run-123", "--remote"], deps, factory);

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123", {
      remote: true,
      rootDir: "/tmp/.betterprompt",
    });
  });

  it("handles invalid run ID error", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runOutputs(["   "], deps, factory);

    expect(deps.fetchRun).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles run not found errors", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw new Error("Run not found: run-404");
      }),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-404"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: Run not found: run-404")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("shows --remote hint when local fetch fails", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw new Error("Run not found in local persistence: run-404");
      }),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-404"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Outputs command failed: Run not found in local persistence: run-404\nHint: retry with --remote to fetch from API."
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw "timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runOutputs(["run-500"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("outputs list command", () => {
  const runOutputsList = async (
    args: string[],
    deps: ReturnType<typeof createDeps>,
    factory: Partial<TCommandFactoryDeps>
  ) => {
    const root = createRoot(deps, factory);
    await root.parseAsync(["outputs", "list", ...args], { from: "user" });
  };

  it("reads local history by default and displays results", async () => {
    const deps = createDeps({
      readHistoryEntries: mock(async () => [
        {
          runId: "run-1",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Succeeded,
          persistedAt: "2026-03-04T11:00:00.000Z",
          outputPath: "/tmp/outputs/run-1",
        },
      ]),
    });
    const factory = createFactoryDeps();

    await runOutputsList([], deps, factory);

    expect(deps.listOutputs).not.toHaveBeenCalled();
    expect(deps.readHistoryEntries).toHaveBeenCalledWith("/tmp/.betterprompt");
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("run-1"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("uses remote API only when --remote is provided", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--remote"], deps, factory);

    expect(listOutputs).toHaveBeenCalledWith({ remote: true });
    expect(deps.readHistoryEntries).not.toHaveBeenCalled();
  });

  it.each([
    RunStatus.Queued,
    RunStatus.Running,
    RunStatus.Succeeded,
    RunStatus.Failed,
  ])("forwards --status=%s filter", async (status) => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--status", status, "--remote"], deps, factory);

    expect(listOutputs).toHaveBeenCalledWith({ status, remote: true });
  });

  it("forwards --limit as number", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--limit", "25", "--remote"], deps, factory);

    expect(listOutputs).toHaveBeenCalledWith({ limit: 25, remote: true });
  });

  it("forwards --since filter", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--since", "2026-03-01", "--remote"], deps, factory);

    expect(listOutputs).toHaveBeenCalledWith({
      since: "2026-03-01",
      remote: true,
    });
  });

  it("forwards combined filters in a single request", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };
    const factory = createFactoryDeps();

    await runOutputsList(
      [
        "--status",
        RunStatus.Succeeded,
        "--limit",
        "10",
        "--since",
        "2026-03-01",
        "--remote",
      ],
      deps,
      factory
    );

    expect(listOutputs).toHaveBeenCalledWith({
      status: RunStatus.Succeeded,
      limit: 10,
      since: "2026-03-01",
      remote: true,
    });
  });

  it("returns structured JSON with local history matches in --json mode", async () => {
    const readHistoryEntries = mock(async () => [
      {
        runId: "run-7",
        skillVersionId: "caption-generator",
        runStatus: RunStatus.Succeeded,
        persistedAt: "2026-03-04T11:00:00.000Z",
        outputPath: "/tmp/outputs/2026/03/output_run-7",
      },
    ]);

    const deps = {
      ...createDeps(),
      readHistoryEntries,
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>, { outputFormat: string }];

    expect(ctx.outputFormat).toBe("json");
    expect(result).toEqual({
      rows: [
        {
          runId: "run-7",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Succeeded,
          createdAt: "2026-03-04T11:00:00.000Z",
          localOutputPath: "/tmp/outputs/2026/03/output_run-7",
        },
      ],
    });
  });

  it("prefers createdAt from local history when available", async () => {
    const deps = {
      ...createDeps(),
      readHistoryEntries: mock(async () => [
        {
          runId: "run-11",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Succeeded,
          createdAt: "2026-03-04T10:30:00.000Z",
          persistedAt: "2026-03-04T11:00:00.000Z",
          outputPath: "/tmp/local/run-11",
        },
      ]),
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>, { outputFormat: string }];

    expect(ctx.outputFormat).toBe("json");
    expect(result).toEqual({
      rows: [
        {
          runId: "run-11",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Succeeded,
          createdAt: "2026-03-04T10:30:00.000Z",
          localOutputPath: "/tmp/local/run-11",
        },
      ],
    });
  });

  it("renders human-readable tabular output", async () => {
    const deps = {
      ...createDeps(),
      readHistoryEntries: mock(async () => [
        {
          runId: "run-10",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Running,
          persistedAt: "2026-03-04T11:00:00.000Z",
          outputPath: "/tmp/local/run-10",
        },
      ]),
    };
    const factory = createFactoryDeps();

    await runOutputsList([], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringMatching(/RUN ID\s+SKILL VERSION ID\s+STATUS\s+CREATED AT/i),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("cross-references local history.jsonl when present", async () => {
    const deps = {
      ...createDeps(),
      readHistoryEntries: mock(async () => [
        {
          runId: "run-local",
          skillVersionId: "caption-generator",
          runStatus: RunStatus.Succeeded,
          persistedAt: "2026-03-04T11:00:00.000Z",
          outputDir: "outputs/run-local",
        },
      ]),
    };
    const factory = createFactoryDeps();

    await runOutputsList([], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("run-local"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("handles empty results", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => []),
    };
    const factory = createFactoryDeps();

    await runOutputsList([], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("No outputs found"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("returns empty rows array in --json mode when no results are found", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => []),
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      { rows: [] },
      expect.objectContaining({ outputFormat: "json" })
    );
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("handles list API failures gracefully", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => {
        throw new Error("API unavailable");
      }),
    };
    const factory = createFactoryDeps();

    await runOutputsList(["--remote"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: API unavailable")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("buildOutputsListQuery", () => {
  it("forwards limit, since (as unix ms), and status to the remote API", () => {
    expect(
      buildOutputsListQuery({
        remote: true,
        status: RunStatus.Succeeded,
        limit: 10,
        since: "2026-03-01",
      })
    ).toEqual({
      limit: 10,
      since: new Date("2026-03-01").getTime(),
      status: "succeeded",
    });
  });
});
