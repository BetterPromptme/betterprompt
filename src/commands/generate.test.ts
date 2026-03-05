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
    readStdin: mock(async () => "{}"),
    resolveScope: mock(async () => ({
      type: "project" as const,
      rootDir: "/tmp/.betterprompt",
    })),
    persistRunOutput: mock(async () => ({
      outputDir: "/tmp/.betterprompt/outputs/2026/03/run-123",
      historyFilePath: "/tmp/.betterprompt/outputs/history.jsonl",
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
  return (firstCall[0] as Record<string, unknown> | undefined) ?? {};
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

  it("does not expose the removed --interactive flag in help", () => {
    const deps = createDeps();
    const command = createGenerateCommand(deps);
    const help = command.helpInformation();

    expect(help).not.toContain("--interactive");
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
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      inputs: { textInputs: {} },
    });
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
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      inputs: { textInputs: { topic: "ai", tone: "professional" } },
    });
  });

  it("collects repeated image input flags", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--image-input-url",
        "https://example.com/a.png",
        "--image-input-url",
        "https://example.com/b.png",
        "--image-input-base64",
        "YmFzZTY0LWltYWdl",
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      inputs: {
        textInputs: {},
        imageInputs: [
          { type: "url", url: "https://example.com/a.png" },
          { type: "url", url: "https://example.com/b.png" },
          { type: "base64", base64: "YmFzZTY0LWltYWdl" },
        ],
      },
    });
  });

  it("parses --model and reads run inputs from --stdin", async () => {
    const deps = createDeps({
      readStdin: mock(
        async () =>
          '{"textInputs":{"topic":"from-stdin"},"imageInputs":[{"type":"url","url":"https://example.com/stdin.png"}]}'
      ),
    });

    await runGenerate(
      [
        "skill-version-123",
        "--model",
        "gpt-4.1",
        "--stdin",
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      runModel: "gpt-4.1",
      inputs: {
        textInputs: { topic: "from-stdin" },
        imageInputs: [{ type: "url", url: "https://example.com/stdin.png" }],
      },
    });
    expect(deps.readStdin).toHaveBeenCalledTimes(1);
  });

  it("parses --run-option json flag", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--run-option",
        '{"reasoningEffort":"high","quality":"hd"}',
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      runOptions: { reasoningEffort: "high", quality: "hd" },
    });
  });

  it("parses --input-payload json flag", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--input-payload",
        '{"textInputs":{"topic":"from-payload"}}',
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation).toMatchObject({
      promptVersionId: "skill-version-123",
      inputs: { textInputs: { topic: "from-payload" } },
    });
  });

  it("merges stdin text inputs with --input, with --input taking precedence", async () => {
    const deps = createDeps({
      readStdin: mock(async () => '{"textInputs":{"topic":"from-stdin","tone":"friendly"}}'),
    });

    await runGenerate(
      [
        "skill-version-123",
        "--stdin",
        "--input",
        "topic=from-cli",
      ],
      deps
    );

    const invocation = getGenerateInvocation(deps);
    expect(invocation).toMatchObject({
      inputs: {
        textInputs: {
          topic: "from-cli",
          tone: "friendly",
        },
      },
    });
  });

  it("rejects combining --input-payload with --input", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--input-payload",
        '{"textInputs":{"topic":"from-payload"}}',
        "--input",
        "topic=from-cli",
      ],
      deps
    );

    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "--input-payload cannot be used with --input, --image-input-url, --image-input-base64, or --stdin."
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("rejects combining --input-payload with image flags", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--input-payload",
        '{"textInputs":{"topic":"from-payload"}}',
        "--image-input-url",
        "https://example.com/a.png",
      ],
      deps
    );

    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "--input-payload cannot be used with --input, --image-input-url, --image-input-base64, or --stdin."
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("rejects combining --input-payload with --stdin", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--input-payload",
        '{"textInputs":{"topic":"from-payload"}}',
        "--stdin",
      ],
      deps
    );

    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "--input-payload cannot be used with --input, --image-input-url, --image-input-base64, or --stdin."
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows help text when --stdin payload is invalid JSON", async () => {
    const deps = createDeps({
      readStdin: mock(async () => "not-json"),
    });

    await runGenerate(["skill-version-123", "--stdin"], deps);

    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("inputs must be a valid JSON object.")
    );
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Usage: betterprompt generate")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
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
    expect(deps.persistRunOutput).toHaveBeenCalledTimes(1);
  });

  it("automatically persists run outputs locally when generate returns a run result", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [{ type: PART_TYPE.TEXT, data: "hello world" }],
      })),
    });

    await runGenerate(["skill-version-123", "--model", "gpt-5"], deps);

    expect(deps.resolveScope).toHaveBeenCalledTimes(1);
    expect(deps.persistRunOutput).toHaveBeenCalledTimes(1);
    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: "project", rootDir: "/tmp/.betterprompt" },
        runId: "run-123",
        skillVersionId: "skill-version-123",
        request: {
          promptVersionId: "skill-version-123",
          inputs: { textInputs: {} },
          runModel: "gpt-5",
        },
        response: {
          runId: "run-123",
          runStatus: RunStatus.Succeeded,
          outputs: [{ type: PART_TYPE.TEXT, data: "hello world" }],
        },
      })
    );
  });

  it("passes image input flags to persisted run payload as imageInputs", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [{ type: PART_TYPE.TEXT, data: "hello world" }],
      })),
    });

    await runGenerate(
      [
        "skill-version-123",
        "--image-input-url",
        "https://example.com/a.png",
        "--image-input-base64",
        "YmFzZTY0LWltYWdl",
      ],
      deps
    );

    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          promptVersionId: "skill-version-123",
          inputs: {
            textInputs: {},
            imageInputs: [
              {
                type: "url",
                url: "https://example.com/a.png",
              },
              {
                type: "base64",
                base64: "YmFzZTY0LWltYWdl",
              },
            ],
          },
        }),
      })
    );
  });

  it("maps --input-payload json object to request.inputs", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.Succeeded,
        outputs: [{ type: PART_TYPE.TEXT, data: "hello world" }],
      })),
    });

    await runGenerate(
      [
        "skill-version-123",
        "--input-payload",
        '{"textInputs":{"topic":"from-payload"},"imageInputs":[{"type":"url","url":"https://example.com/payload.png"}]}',
      ],
      deps
    );

    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          inputs: {
            textInputs: {
              topic: "from-payload",
            },
            imageInputs: [
              {
                type: "url",
                url: "https://example.com/payload.png",
              },
            ],
          },
        }),
      })
    );
  });

  it("does not persist when generate result is not a run payload", async () => {
    const deps = createDeps({
      generate: mock(async () => ({ ok: true })),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.resolveScope).not.toHaveBeenCalled();
    expect(deps.persistRunOutput).not.toHaveBeenCalled();
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
