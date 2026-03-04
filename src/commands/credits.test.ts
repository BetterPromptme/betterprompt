import { afterEach, describe, expect, it, mock } from "bun:test";
import { AUTH_MESSAGES } from "../constants";
import { createCreditsCommand } from "./credits";

type TCreditsDeps = NonNullable<Parameters<typeof createCreditsCommand>[0]>;

const createDeps = (overrides: Partial<TCreditsDeps> = {}): TCreditsDeps => ({
  getCredits: mock(async () => ({
    credits: 1_250_000,
  })),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runCredits = async (args: string[], deps: TCreditsDeps) => {
  const command = createCreditsCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("credits command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("shows authenticated user credit balance in default output mode", async () => {
    const deps = createDeps();

    await runCredits([], deps);

    expect(deps.getCredits).toHaveBeenCalledTimes(1);
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledTimes(1);

    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(typeof data).toBe("string");
    expect(data).toEqual(expect.stringContaining("Credits: 1,250,000.0"));
    expect(ctx.outputFormat).toBe("text");
  });

  it("outputs structured JSON when --json is provided", async () => {
    const deps = createDeps();

    await runCredits(["--json"], deps);

    expect(deps.getCredits).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      credits: 1_250_000,
    });
    expect(ctx.outputFormat).toBe("json");
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("shows unauthenticated error when API key is missing", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
      }),
    });

    await runCredits([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(AUTH_MESSAGES.apiKeyNotFoundError)
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles API errors gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw new Error("GET /credits failed (500)");
      }),
    });

    await runCredits([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("GET /credits failed (500)")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw "credits timeout";
      }),
    });

    await runCredits([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("credits timeout")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
