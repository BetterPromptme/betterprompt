import { afterEach, describe, expect, it, mock } from "bun:test";
import { AUTH_MESSAGES } from "../../constants";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createWhoamiCommand } from "./command";
import type { TWhoamiDependencies } from "./types";

const createDeps = (overrides: Partial<TWhoamiDependencies> = {}): TWhoamiDependencies => ({
  getCurrentUser: mock(async () => ({
    username: "jane",
    displayName: "Jane Doe",
    userFlags: 0,
  })),
  ...overrides,
});

const createFactoryDeps = (
  overrides: Partial<TCommandFactoryDeps> = {}
): Partial<TCommandFactoryDeps> => ({
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runWhoami = async (
  args: string[],
  deps: TWhoamiDependencies,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const command = createWhoamiCommand(deps, factoryDeps);
  await command.parseAsync(args, { from: "user" });
};

describe("whoami command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("shows authenticated identity fields in default output mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runWhoami([], deps, factory);

    expect(deps.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
    expect(factory.printResult).toHaveBeenCalledTimes(1);

    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(typeof data).toBe("string");
    expect(data as string).toContain("jane");
    expect(data as string).toContain("Jane Doe");
    expect(data as string).toContain("0");
    expect(ctx.outputFormat).toBe("text");
  });

  it("outputs structured JSON when --json is provided", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runWhoami(["--json"], deps, factory);

    expect(deps.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      username: "jane",
      displayName: "Jane Doe",
      userFlags: 0,
    });
    expect(ctx.outputFormat).toBe("json");
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("shows unauthenticated error when API key is missing", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
      }),
    });
    const factory = createFactoryDeps();

    await runWhoami([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(AUTH_MESSAGES.apiKeyNotFoundError)
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles API errors gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw new Error("GET /me failed (500)");
      }),
    });
    const factory = createFactoryDeps();

    await runWhoami([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("GET /me failed (500)")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw "network timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runWhoami([], deps, factory);

    expect(factory.printResult).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(1);
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("network timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
