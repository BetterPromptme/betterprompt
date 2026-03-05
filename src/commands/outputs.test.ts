import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { PART_TYPE, RunStatus } from "../enums";
import { buildOutputsListQuery, createOutputsCommand } from "./outputs";

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

const runOutputs = async (
  args: string[],
  deps: ReturnType<typeof createDeps>
) => {
  const root = createRoot(deps);
  await root.parseAsync(["outputs", ...args], { from: "user" });
};

describe("outputs command", () => {
  it("fetches run result by ID from local persistence by default", async () => {
    const deps = createDeps();

    await runOutputs(["run-123"], deps);

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

    await runOutputs(["run-text"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      "A plain text artifact",
      expect.objectContaining({ outputFormat: "text" })
    );
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

    await runOutputs(["run-image", "--sync"], deps);

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

    await runOutputs(["run-video"], deps);

    expect(deps.persistRunOutput).not.toHaveBeenCalled();
  });

  it("returns structured metadata in --json mode", async () => {
    const deps = createDeps();

    await runOutputs(["run-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [
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

    await runOutputs(["run-123", "--remote"], deps);

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123", {
      remote: true,
      rootDir: "/tmp/.betterprompt",
    });
  });

  it("handles invalid run ID error", async () => {
    const deps = createDeps();

    await runOutputs(["   "], deps);

    expect(deps.fetchRun).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles run not found errors", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw new Error("Run not found: run-404");
      }),
    });

    await runOutputs(["run-404"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: Run not found: run-404")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("shows --remote hint when local fetch fails", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw new Error("Run not found in local persistence: run-404");
      }),
    });

    await runOutputs(["run-404"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Outputs command failed: Run not found in local persistence: run-404\nHint: retry with --remote to fetch from API."
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => {
        throw "timeout";
      }),
    });

    await runOutputs(["run-500"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: timeout")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});

describe("outputs list command", () => {
  const runOutputsList = async (
    args: string[],
    deps: ReturnType<typeof createDeps>
  ) => {
    const root = createRoot(deps);
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

    await runOutputsList([], deps);

    expect(deps.listOutputs).not.toHaveBeenCalled();
    expect(deps.readHistoryEntries).toHaveBeenCalledWith("/tmp/.betterprompt");
    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runOutputsList(["--remote"], deps);

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

    await runOutputsList(["--status", status, "--remote"], deps);

    expect(listOutputs).toHaveBeenCalledWith({ status, remote: true });
  });

  it("forwards --limit as number", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(["--limit", "25", "--remote"], deps);

    expect(listOutputs).toHaveBeenCalledWith({ limit: 25, remote: true });
  });

  it("forwards --since filter", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(["--since", "2026-03-01", "--remote"], deps);

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
      deps
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

    await runOutputsList(["--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
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

    await runOutputsList(["--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
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

    await runOutputsList([], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runOutputsList([], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("run-local"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("handles empty results", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => []),
    };

    await runOutputsList([], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("No outputs found"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("returns empty rows array in --json mode when no results are found", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => []),
    };

    await runOutputsList(["--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledWith(
      { rows: [] },
      expect.objectContaining({ outputFormat: "json" })
    );
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("handles list API failures gracefully", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => {
        throw new Error("API unavailable");
      }),
    };

    await runOutputsList(["--remote"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: API unavailable")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});

describe("buildOutputsListQuery", () => {
  it("omits non-api filters and unsupported fields", () => {
    expect(
      buildOutputsListQuery({
        remote: true,
        status: RunStatus.Succeeded,
        limit: 10,
        since: "2026-03-01",
      })
    ).toEqual({
      limit: 10,
    });
  });
});
