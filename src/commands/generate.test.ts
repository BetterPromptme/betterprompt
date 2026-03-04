import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import {
  createGenerateCommand,
  formatGenerateOptionErrorMessage,
} from "./generate";
import { PART_TYPE, RunStatus } from "../enums";

const createDeps = (overrides = {}) =>
  ({
    generate: mock(async () => ({
      runId: "run-123",
      outputs: [],
      runStatus: RunStatus.Queued,
    })),
    printResult: mock(() => {}),
    error: mock(() => {}),
    setExitCode: mock(() => {}),
    ...overrides,
  }) satisfies NonNullable<Parameters<typeof createGenerateCommand>[0]>;

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
    .addCommand(createGenerateCommand(deps));

  return root;
};

const runGenerate = async (
  args: string[],
  deps: ReturnType<typeof createDeps>
) => {
  const root = createRoot(deps);
  await root.parseAsync(["generate", ...args], { from: "user" });
};

const getGenerateInvocation = (deps: ReturnType<typeof createDeps>) => {
  const calls = (deps.generate as ReturnType<typeof mock>).mock.calls;
  expect(calls.length).toBe(1);

  const firstCall = calls[0] as unknown[];
  const firstArg = firstCall[0] as unknown;

  if (typeof firstArg === "string") {
    return {
      skillVersionId: firstArg,
      options: (firstCall[1] as Record<string, unknown> | undefined) ?? {},
    };
  }

  return {
    skillVersionId: (firstArg as { skillVersionId?: string }).skillVersionId,
    options: (firstArg as Record<string, unknown>) ?? {},
  };
};

describe("generate command", () => {
  it("includes help hints for finding skillVersionId", () => {
    const deps = createDeps();
    const command = createGenerateCommand(deps);
    const help = command.helpInformation();
    const normalizedHelp = help.replace(/\s+/g, " ");

    expect(normalizedHelp).toContain("Get <skillVersionId> via");
    expect(normalizedHelp).toContain("bp skill list");
    expect(normalizedHelp).toContain("bp skill info <skill-slug>");
  });

  it("formats missing --input option error with an actionable hint", () => {
    const formatted = formatGenerateOptionErrorMessage(
      "error: option '--input <key=value>' argument missing\n"
    );

    expect(formatted).toContain(
      "error: option '--input <key=value>' argument missing"
    );
    expect(formatted).toContain(
      "Hint: pass --input as key=value (example: --input topic=ai)."
    );
  });

  it("keeps unrelated option errors unchanged", () => {
    const message = "error: unknown option '--inpoot'\n";
    const formatted = formatGenerateOptionErrorMessage(message);

    expect(formatted).toBe(message);
  });

  it("accepts <skillVersionId> argument", async () => {
    const deps = createDeps();

    await runGenerate(["skill-version-123"], deps);

    const invocation = getGenerateInvocation(deps);
    expect(invocation.skillVersionId).toBe("skill-version-123");
    expect(deps.printResult).toHaveBeenCalledTimes(1);
  });

  it("collects repeated --input key=value pairs", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--input",
        "topic=ai",
        "--input",
        "tone=professional",
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation.skillVersionId).toBe("skill-version-123");
    expect(invocation.options).toMatchObject({
      input: ["topic=ai", "tone=professional"],
    });
  });

  it("parses --model, --save-run, --stdin, and --interactive flags", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--model",
        "gpt-4.1",
        "--save-run",
        "--stdin",
        "--interactive",
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation.skillVersionId).toBe("skill-version-123");
    expect(invocation.options).toMatchObject({
      model: "gpt-4.1",
      saveRun: true,
      stdin: true,
      interactive: true,
    });
  });

  it("parses --json from global flags into command output context", async () => {
    const deps = createDeps();

    await runGenerate(["skill-version-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(ctx.outputFormat).toBe("json");
  });

  it("pretty-prints markdown for TEXT part output in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.TEXT,
            data: "## Generated Markdown\n\nThis is a body.",
          },
        ],
      })),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      "## Generated Markdown\n\nThis is a body.",
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("pretty-prints S3 key for IMAGE part output in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.IMAGE,
            data: "outputs/run-123/image-1.png",
          },
        ],
      })),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      "outputs/run-123/image-1.png",
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("pretty-prints S3 key for VIDEO part output in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.VIDEO,
            data: "outputs/run-123/video-1.mp4",
          },
        ],
      })),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      "outputs/run-123/video-1.mp4",
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("displays message for ERROR part output in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Failed,
        outputs: [
          {
            type: PART_TYPE.ERROR,
            data: "Generation failed due to invalid input.",
          },
        ],
      })),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      "Generation failed due to invalid input.",
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("returns raw TRunResult when --json is enabled", async () => {
    const rawRunResult = {
      runId: "run-123",
      runStatus: RunStatus.Succeeded,
      outputs: [
        { type: PART_TYPE.TEXT, data: "hello" },
        { type: PART_TYPE.IMAGE, data: "outputs/run-123/image.png" },
      ],
    };

    const deps = createDeps({
      generate: mock(async () => rawRunResult),
    });

    await runGenerate(["skill-version-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      rawRunResult,
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("handles multiple output parts in order", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [
          {
            type: PART_TYPE.TEXT,
            data: "First markdown block",
          },
          {
            type: PART_TYPE.IMAGE,
            data: "outputs/run-123/image-1.png",
          },
          {
            type: PART_TYPE.VIDEO,
            data: "outputs/run-123/video-1.mp4",
          },
          {
            type: PART_TYPE.ERROR,
            data: "A recoverable part-level error happened.",
          },
        ],
      })),
    });

    await runGenerate(["skill-version-123"], deps);

    const printCalls = (deps.printResult as ReturnType<typeof mock>).mock.calls;
    expect(printCalls).toHaveLength(4);
    expect(printCalls[0]?.[0]).toBe("First markdown block");
    expect(printCalls[1]?.[0]).toBe("outputs/run-123/image-1.png");
    expect(printCalls[2]?.[0]).toBe("outputs/run-123/video-1.mp4");
    expect(printCalls[3]?.[0]).toBe("A recoverable part-level error happened.");
  });

  it("shows help text when generation request fails", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new Error("Network unavailable");
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Network unavailable")
    );
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Usage: betterprompt generate")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

});
