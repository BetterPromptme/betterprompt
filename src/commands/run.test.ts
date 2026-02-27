import { describe, expect, it, mock } from "bun:test";
import { createRunCommand } from "./run";
import { RunStatus } from "../enums/run-status";

type TRunDeps = NonNullable<Parameters<typeof createRunCommand>[0]>;

const createDeps = (overrides: Partial<TRunDeps> = {}): TRunDeps => ({
  run: mock(async () => ({
    status: "SUCCESS",
    data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
  })),
  log: mock(() => {}),
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
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          status: "SUCCESS",
          data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
        },
        null,
        2
      )
    );
  });

  it("includes runModel in payload when --model is provided", async () => {
    const deps = createDeps();

    await runCommand(
      [
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

    await runCommand(["--promptVersionId", "uuid-123"], deps);

    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      "Run command failed: You must provide --inputs."
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when --inputs is invalid JSON", async () => {
    const deps = createDeps();

    await runCommand(
      ["--promptVersionId", "uuid-123", "--inputs", "not-json"],
      deps
    );

    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      "Run command failed: inputs must be a valid JSON object."
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("logs error and sets exit code when --runOptions is invalid JSON", async () => {
    const deps = createDeps();

    await runCommand(
      [
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
      "Run command failed: runOptions must be a valid JSON object."
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
      ["--promptVersionId", "uuid-123", "--inputs", '{"textInputs":{}}'],
      deps
    );

    expect(deps.error).toHaveBeenCalledWith("Run command failed: API error");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.log).not.toHaveBeenCalled();
  });
});
