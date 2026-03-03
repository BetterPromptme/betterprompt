import { describe, expect, it, mock } from "bun:test";
import { createRunCommand } from "./run";
import { RunStatus } from "../enums/run-status";

type TRunDeps = NonNullable<Parameters<typeof createRunCommand>[0]>;

const createDeps = (overrides: Partial<TRunDeps> = {}): TRunDeps => ({
  run: mock(async () => ({
    status: "SUCCESS",
    data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
  })),
  getRunById: mock(async () => ({
    status: "SUCCESS",
    data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
  })),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runCommand = async (args: string[], deps: TRunDeps) => {
  const command = createRunCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("run command", () => {
  it("runs with --inputs and prints json result", async () => {
    const deps = createDeps();

    await runCommand(
      [
        "exec",
        "--promptVersionId",
        "uuid-123",
        "--inputs",
        '{"textInputs":{"name":"Alice"}}',
      ],
      deps
    );

    expect(deps.run).toHaveBeenCalledWith({
      promptVersionId: "uuid-123",
      inputs: { textInputs: { name: "Alice" } },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      status: "SUCCESS",
      data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
    });
    expect(ctx.outputFormat).toBe("text");
  });

  it("includes runModel in payload when --model is provided", async () => {
    const deps = createDeps();

    await runCommand(
      [
        "exec",
        "--promptVersionId",
        "uuid-123",
        "--inputs",
        '{"textInputs":{}}',
        "--model",
        "gpt-4o",
      ],
      deps
    );

    expect(deps.run).toHaveBeenCalledWith({
      promptVersionId: "uuid-123",
      inputs: { textInputs: {} },
      runModel: "gpt-4o",
    });
  });

  it("includes runOptions in payload when --runOptions is provided", async () => {
    const deps = createDeps();

    await runCommand(
      [
        "exec",
        "--promptVersionId",
        "uuid-123",
        "--inputs",
        '{"textInputs":{}}',
        "--runOptions",
        '{"reasoningEffort":"high","quality":"hd"}',
      ],
      deps
    );

    expect(deps.run).toHaveBeenCalledWith({
      promptVersionId: "uuid-123",
      inputs: { textInputs: {} },
      runOptions: { reasoningEffort: "high", quality: "hd" },
    });
  });

  it("logs error and sets exit code when --inputs is not given", async () => {
    const deps = createDeps();

    await runCommand(["exec", "--promptVersionId", "uuid-123"], deps);

    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Run command failed: You must provide --inputs.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when --inputs is invalid JSON", async () => {
    const deps = createDeps();

    await runCommand(
      ["exec", "--promptVersionId", "uuid-123", "--inputs", "not-json"],
      deps
    );

    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Run command failed: inputs must be a valid JSON object.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when --runOptions is invalid JSON", async () => {
    const deps = createDeps();

    await runCommand(
      [
        "exec",
        "--promptVersionId",
        "uuid-123",
        "--inputs",
        '{"textInputs":{}}',
        "--runOptions",
        "bad",
      ],
      deps
    );

    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Run command failed: runOptions must be a valid JSON object.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when run throws", async () => {
    const deps = createDeps({
      run: mock(async () => {
        throw new Error("API error");
      }),
    });

    await runCommand(
      ["exec", "--promptVersionId", "uuid-123", "--inputs", '{"textInputs":{}}'],
      deps
    );

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Run command failed: API error"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});

describe("run get command", () => {
  it("fetches a run by ID and prints json result", async () => {
    const deps = createDeps();

    await runCommand(["get", "--runId", "run-abc-123"], deps);

    expect(deps.getRunById).toHaveBeenCalledWith("run-abc-123");
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      status: "SUCCESS",
      data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
    });
    expect(ctx.outputFormat).toBe("text");
  });

  it("logs error and sets exit code when --runId is empty string", async () => {
    const deps = createDeps();

    await runCommand(["get", "--runId", "   "], deps);

    expect(deps.getRunById).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Run command failed: runId must not be empty.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when getRunById throws", async () => {
    const deps = createDeps({
      getRunById: mock(async () => {
        throw new Error("not found");
      }),
    });

    await runCommand(["get", "--runId", "run-abc-123"], deps);

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Run command failed: not found"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
