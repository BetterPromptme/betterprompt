import { afterEach, describe, expect, it, mock } from "bun:test";
import { AUTH_MESSAGES } from "../../constants";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createCreditsCommand } from "./command";
import type { TCreditsDependencies } from "./types";

const createDeps = (overrides: Partial<TCreditsDependencies> = {}): TCreditsDependencies => ({
  getCredits: mock(async () => ({
    credits: 1_250_000,
  })),
  ...overrides,
});

const createFactoryDeps = (
  overrides: Partial<TCommandFactoryDeps> = {}
): Partial<TCommandFactoryDeps> => ({
  createSpinner: mock(() => {
    const s = { start: mock(() => s), succeed: mock(() => s), fail: mock(() => s) };
    return s;
  }),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runCredits = async (
  args: string[],
  deps: TCreditsDependencies,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const command = createCreditsCommand(deps, factoryDeps);
  await command.parseAsync(args, { from: "user" });
};

describe("credits command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("shows authenticated user credit balance in default output mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runCredits([], deps, factory);

    expect(deps.getCredits).toHaveBeenCalledTimes(1);
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
    expect(factory.printResult).toHaveBeenCalledTimes(1);

    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(typeof data).toBe("string");
    expect(data).toEqual(expect.stringContaining("Credits: 1,250,000.0"));
    expect(ctx.outputFormat).toBe("text");
  });

  it("outputs structured JSON when --json is provided", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runCredits(["--json"], deps, factory);

    expect(deps.getCredits).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      credits: 1_250_000,
    });
    expect(ctx.outputFormat).toBe("json");
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("shows unauthenticated error when API key is missing", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
      }),
    });
    const factory = createFactoryDeps();

    await runCredits([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(AUTH_MESSAGES.apiKeyNotFoundError)
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles API errors gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw new Error("GET /credits failed (500)");
      }),
    });
    const factory = createFactoryDeps();

    await runCredits([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("GET /credits failed (500)")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCredits: mock(async () => {
        throw "credits timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runCredits([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("credits timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
