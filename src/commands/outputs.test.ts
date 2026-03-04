import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { PART_TYPE, RunStatus } from "../enums";
import { createOutputsCommand } from "./outputs";

type TOutputsCommandDeps = NonNullable<Parameters<typeof createOutputsCommand>[0]>;
type TListOutputsResult = Awaited<ReturnType<TOutputsCommandDeps["listOutputs"]>>;
type THistoryEntriesResult = Awaited<
  ReturnType<TOutputsCommandDeps["readHistoryEntries"]>
>;

const createDeps = (overrides: Partial<TOutputsCommandDeps> = {}): TOutputsCommandDeps =>
  ({
    fetchRun: mock(async () => ({
      runId: "run-123",
      runStatus: RunStatus.Succeeded,
      outputs: [
        {
          type: PART_TYPE.TEXT,
          data: "Generated text output",
        },
      ],
    })),
    downloadAssets: mock(async () => ({
      outputPath: "/tmp/outputs/run-123",
      downloadedFiles: [],
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
  it("fetches run result by ID from API", async () => {
    const deps = createDeps();

    await runOutputs(["run-123"], deps);

    expect(deps.fetchRun).toHaveBeenCalledWith("run-123");
  });

  it("prints text output to stdout in text mode", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-text",
        runStatus: RunStatus.Succeeded,
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

  it("downloads assets to --out path", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-image",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.IMAGE,
            data: "outputs/run-image/image.png",
          },
        ],
      })),
    });

    await runOutputs(["run-image", "--out", "/tmp/custom-out"], deps);

    expect(deps.downloadAssets).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-image" }),
      "/tmp/custom-out"
    );
  });

  it("uses default asset download location when --out is not provided", async () => {
    const deps = createDeps({
      fetchRun: mock(async () => ({
        runId: "run-video",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.VIDEO,
            data: "outputs/run-video/video.mp4",
          },
        ],
      })),
    });

    await runOutputs(["run-video"], deps);

    expect(deps.downloadAssets).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-video" }),
      undefined
    );
  });

  it("returns structured metadata in --json mode", async () => {
    const deps = createDeps({
      downloadAssets: mock(async () => ({
        outputPath: "/tmp/json-out",
        downloadedFiles: ["/tmp/json-out/image.png"],
      })),
    });

    await runOutputs(["run-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [result, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>, { outputFormat: string }];

    expect(ctx.outputFormat).toBe("json");
    expect(result).toMatchObject({
      runId: "run-123",
      runStatus: RunStatus.Succeeded,
      outputPath: "/tmp/json-out",
      downloadedFiles: ["/tmp/json-out/image.png"],
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

  it("queries API and displays results", async () => {
    const listOutputs = mock(async () => [
      {
        runId: "run-1",
        skillName: "caption-generator",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
      },
    ]);

    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList([], deps);

    expect(listOutputs).toHaveBeenCalledWith({});
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("run-1"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("forwards --skill filter", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(["--skill", "caption-generator"], deps);

    expect(listOutputs).toHaveBeenCalledWith({ skill: "caption-generator" });
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

    await runOutputsList(["--status", status], deps);

    expect(listOutputs).toHaveBeenCalledWith({ status });
  });

  it("forwards --limit as number", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(["--limit", "25"], deps);

    expect(listOutputs).toHaveBeenCalledWith({ limit: 25 });
  });

  it("forwards --since filter", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(["--since", "2026-03-01"], deps);

    expect(listOutputs).toHaveBeenCalledWith({ since: "2026-03-01" });
  });

  it("forwards combined filters in a single request", async () => {
    const listOutputs = mock(async () => []);
    const deps = {
      ...createDeps(),
      listOutputs,
    };

    await runOutputsList(
      [
        "--skill",
        "caption-generator",
        "--status",
        RunStatus.Succeeded,
        "--limit",
        "10",
        "--since",
        "2026-03-01",
      ],
      deps
    );

    expect(listOutputs).toHaveBeenCalledWith({
      skill: "caption-generator",
      status: RunStatus.Succeeded,
      limit: 10,
      since: "2026-03-01",
    });
  });

  it("returns structured JSON with local history matches in --json mode", async () => {
    const listOutputs = mock(async () => [
      {
        runId: "run-7",
        skillName: "caption-generator",
        runStatus: RunStatus.Succeeded,
        createdAt: "2026-03-04T11:00:00.000Z",
      },
    ]);

    const readHistoryEntries = mock(async () => [
      { runId: "run-7", outputPath: "/tmp/outputs/2026/03/output_run-7" },
    ]);

    const deps = {
      ...createDeps(),
      listOutputs,
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
          skillName: "caption-generator",
          runStatus: RunStatus.Succeeded,
          createdAt: "2026-03-04T11:00:00.000Z",
          localOutputPath: "/tmp/outputs/2026/03/output_run-7",
        },
      ],
    });
  });

  it("renders human-readable tabular output", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => [
        {
          runId: "run-10",
          skillName: "caption-generator",
          runStatus: RunStatus.Running,
          createdAt: "2026-03-04T11:00:00.000Z",
        },
      ]),
    };

    await runOutputsList([], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringMatching(/RUN ID\s+SKILL\s+STATUS\s+CREATED AT/i),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("cross-references local history.jsonl when present", async () => {
    const deps = {
      ...createDeps(),
      listOutputs: mock(async () => [
        {
          runId: "run-local",
          skillName: "caption-generator",
          runStatus: RunStatus.Succeeded,
          createdAt: "2026-03-04T11:00:00.000Z",
        },
      ]),
      readHistoryEntries: mock(async () => [
        { runId: "run-local", outputPath: "/tmp/local/run-local" },
      ]),
    };

    await runOutputsList([], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/local/run-local"),
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

    await runOutputsList([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Outputs command failed: API unavailable")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
