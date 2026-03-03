import { afterEach, describe, expect, it, mock } from "bun:test";
import { AUTH_MESSAGES } from "../constants";
import { createWhoamiCommand } from "./whoami";

type TWhoamiDeps = NonNullable<Parameters<typeof createWhoamiCommand>[0]>;

const createDeps = (overrides: Partial<TWhoamiDeps> = {}): TWhoamiDeps => ({
  getCurrentUser: mock(async () => ({
    username: "jane",
    displayName: "Jane Doe",
    userFlags: 0,
  })),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runWhoami = async (args: string[], deps: TWhoamiDeps) => {
  const command = createWhoamiCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("whoami command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("shows authenticated identity fields in default output mode", async () => {
    const deps = createDeps();

    await runWhoami([], deps);

    expect(deps.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledTimes(1);

    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(typeof data).toBe("string");
    expect(data as string).toContain("jane");
    expect(data as string).toContain("Jane Doe");
    expect(data as string).toContain("0");
    expect(ctx.outputFormat).toBe("text");
  });

  it("outputs structured JSON when --json is provided", async () => {
    const deps = createDeps();

    await runWhoami(["--json"], deps);

    expect(deps.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      username: "jane",
      displayName: "Jane Doe",
      userFlags: 0,
    });
    expect(ctx.outputFormat).toBe("json");
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("shows unauthenticated error when API key is missing", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
      }),
    });

    await runWhoami([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(AUTH_MESSAGES.apiKeyNotFoundError)
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles API errors gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw new Error("GET /me failed (500)");
      }),
    });

    await runWhoami([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("GET /me failed (500)")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables gracefully and sets exit code", async () => {
    const deps = createDeps({
      getCurrentUser: mock(async () => {
        throw "network timeout";
      }),
    });

    await runWhoami([], deps);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("network timeout")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
