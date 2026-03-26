import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import { PartType, RunStatus } from "../../enums";
import { ApiError } from "../../services/api/client";
import {
  createGenerateCommand,
  formatGenerateOptionErrorMessage,
} from "./command";

const createDeps = (overrides = {}) =>
  ({
    generate: mock(async () => ({
      runId: "run-123",
      outputs: [],
      runStatus: RunStatus.QUEUED,
    })),
    readStdin: mock(async () => "{}"),
    resolveScope: mock(async () => ({
      type: "project" as const,
      rootDir: "/tmp/.betterprompt",
    })),
    resolvePromptVersionId: mock(() => Promise.resolve("skill-version-123")),
    persistRunOutput: mock(async () => ({
      outputDir: "/tmp/.betterprompt/outputs/2026/03/run-123",
      historyFilePath: "/tmp/.betterprompt/outputs/history.jsonl",
    })),
    isStdinTTY: mock(() => false),
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
  it("includes skill-slug argument in help and does not reference skillVersionId", () => {
    const deps = createDeps();
    const command = createGenerateCommand(deps);
    const help = command.helpInformation();
    const normalizedHelp = help.replace(/\s+/g, " ");

    expect(normalizedHelp).not.toContain("skillVersionId");
    expect(normalizedHelp).toContain("skill-slug");
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

  it("accepts <skill-slug> argument and resolves to promptVersionId", async () => {
    const deps = createDeps();

    await runGenerate(["seo-blog-writer"], deps);

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
      ["skill-version-123", "--model", "gpt-4.1", "--stdin"],
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

  it("shows stdin guidance when --stdin is used without piped input", async () => {
    const deps = createDeps({
      isStdinTTY: mock(() => true),
    });

    await runGenerate(["skill-version-123", "--stdin"], deps);

    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "No stdin input detected. Pipe a TRunInputs JSON object when using --stdin."
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("parses --options json flag", async () => {
    const deps = createDeps();

    await runGenerate(
      [
        "skill-version-123",
        "--options",
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
      readStdin: mock(
        async () => '{"textInputs":{"topic":"from-stdin","tone":"friendly"}}'
      ),
    });

    await runGenerate(
      ["skill-version-123", "--stdin", "--input", "topic=from-cli"],
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
        runStatus: RunStatus.SUCCEEDED,
        outputs: [
          {
            type: PartType.TEXT,
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
        runStatus: RunStatus.SUCCEEDED,
        outputs: [
          {
            type: PartType.IMAGE,
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
        runStatus: RunStatus.SUCCEEDED,
        outputs: [
          {
            type: PartType.VIDEO,
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
        runStatus: RunStatus.FAILED,
        outputs: [
          {
            type: PartType.ERROR,
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
      runStatus: RunStatus.SUCCEEDED,
      outputs: [
        { type: PartType.TEXT, data: "hello" },
        { type: PartType.IMAGE, data: "outputs/run-123/image.png" },
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
        runStatus: RunStatus.SUCCEEDED,
        outputs: [{ type: PartType.TEXT, data: "hello world" }],
      })),
    });

    await runGenerate(["skill-version-123", "--model", "gpt-5"], deps);

    expect(deps.resolveScope).toHaveBeenCalledTimes(1);
    expect(deps.persistRunOutput).toHaveBeenCalledTimes(1);
    expect(deps.persistRunOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: "project", rootDir: "/tmp/.betterprompt" },
        runId: "run-123",
        skillSlug: "skill-version-123",
        request: {
          promptVersionId: "skill-version-123",
          inputs: { textInputs: {} },
          runModel: "gpt-5",
        },
        response: {
          runId: "run-123",
          runStatus: RunStatus.SUCCEEDED,
          outputs: [{ type: PartType.TEXT, data: "hello world" }],
        },
      })
    );
  });

  it("passes image input flags to persisted run payload as imageInputs", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.SUCCEEDED,
        outputs: [{ type: PartType.TEXT, data: "hello world" }],
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
        runStatus: RunStatus.SUCCEEDED,
        outputs: [{ type: PartType.TEXT, data: "hello world" }],
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

    expect(deps.persistRunOutput).not.toHaveBeenCalled();
  });

  it("handles multiple output parts in order", async () => {
    const deps = createDeps({
      generate: mock(async () => ({
        runId: "run-123",
        runStatus: RunStatus.SUCCEEDED,
        outputs: [
          {
            type: PartType.TEXT,
            data: "First markdown block",
          },
          {
            type: PartType.IMAGE,
            data: "outputs/run-123/image-1.png",
          },
          {
            type: PartType.VIDEO,
            data: "outputs/run-123/video-1.mp4",
          },
          {
            type: PartType.ERROR,
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

  it("returns structured JSON error for ApiError in json mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "Prompt version not found",
          status: 404,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "NOT_FOUND_ERROR",
            message: "Prompt version not found",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      {
        error: "NOT_FOUND_ERROR",
        message: "Prompt version not found",
        status: 404,
        data: null,
      },
      expect.objectContaining({ outputFormat: "json" })
    );
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows login instruction for 401 in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "Invalid API token",
          status: 401,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "UNAUTHORIZED",
            message: "Invalid API token",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Run `betterprompt login` to authenticate")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows upgrade message for 402 in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "You do not have enough credits",
          status: 402,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "PAYMENT_REQUIRED_ERROR",
            message: "You do not have enough credits",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Insufficient credits or upgrade required")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows rate limit message for 429 in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "Too Many Requests",
          status: 429,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "TOO_MANY_REQUESTS_ERROR",
            message: "Too Many Requests",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Rate limited. Wait a moment and try again")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows polling command for 504 with runId in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message:
            "The request is unable to finish processing within the time limit",
          status: 504,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "GATEWAY_TIMEOUT_ERROR",
            message:
              "The request is unable to finish processing within the time limit",
            data: { runId: "run-timeout-456" },
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("betterprompt outputs run-timeout-456 --sync")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("includes runId in JSON error for 504 timeout", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message:
            "The request is unable to finish processing within the time limit",
          status: 504,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "GATEWAY_TIMEOUT_ERROR",
            message:
              "The request is unable to finish processing within the time limit",
            data: { runId: "run-timeout-456" },
          },
        });
      }),
    });

    await runGenerate(["skill-version-123", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      {
        error: "GATEWAY_TIMEOUT_ERROR",
        message:
          "The request is unable to finish processing within the time limit",
        status: 504,
        data: { runId: "run-timeout-456" },
      },
      expect.objectContaining({ outputFormat: "json" })
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows outputs list fallback for 504 without runId in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message:
            "The request is unable to finish processing within the time limit",
          status: 504,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "GATEWAY_TIMEOUT_ERROR",
            message:
              "The request is unable to finish processing within the time limit",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("betterprompt outputs list --remote")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows server error message for 500 in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "The server had an error while processing your request",
          status: 500,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "SERVER_ERROR",
            message: "The server had an error",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Server error. Try again later")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("passes server message through for 400 in text mode", async () => {
    const deps = createDeps({
      generate: mock(async () => {
        throw new ApiError({
          message: "Message or inputs is required",
          status: 400,
          method: "POST",
          requestUrl: "/runs",
          details: {
            status: "BAD_REQUEST_ERROR",
            message: "Message or inputs is required",
            data: null,
          },
        });
      }),
    });

    await runGenerate(["skill-version-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Message or inputs is required")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
