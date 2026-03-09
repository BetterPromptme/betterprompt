import { afterEach, describe, expect, it, mock } from "bun:test";
import { AUTH_MESSAGES } from "../../constants";
import { createAuthCommand } from "./command";

type TAuthDeps = NonNullable<Parameters<typeof createAuthCommand>[0]>;
type TSpinner = ReturnType<TAuthDeps["createSpinner"]>;

const createSpinner = (): TSpinner => {
  const spinner = {} as TSpinner;
  spinner.start = mock(() => spinner);
  spinner.succeed = mock(() => spinner);
  spinner.fail = mock(() => spinner);
  return spinner;
};

const createDeps = (overrides: Partial<TAuthDeps> = {}): TAuthDeps => ({
  intro: mock(() => {}),
  outro: mock(() => {}),
  cancel: mock(() => {}),
  isCancel: mock(() => false),
  password: mock(async () => "bp_live_123"),
  verifyApiKey: mock(async () => {}),
  saveAuthConfig: mock(async () => "/tmp/.betterprompt/config.json"),
  resolveAuthConfigPath: mock(() => "/tmp/.betterprompt/config.json"),
  createSpinner: mock(() => createSpinner()),
  log: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runAuth = async (args: string[], deps: TAuthDeps) => {
  const command = createAuthCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("auth command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("interactive mode prompts for password, verifies, and saves", async () => {
    const spinner = createSpinner();
    const deps = createDeps({
      createSpinner: mock(() => spinner),
    });

    await runAuth([], deps);

    expect(deps.password).toHaveBeenCalledTimes(1);
    expect(deps.password).toHaveBeenCalledWith({
      message: AUTH_MESSAGES.passwordPrompt,
      placeholder: AUTH_MESSAGES.passwordPlaceholder,
      validate: expect.any(Function),
    });
    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_live_123");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("bp_live_123");
    expect(deps.intro).toHaveBeenCalledWith(AUTH_MESSAGES.introTitle);
    expect(deps.createSpinner).toHaveBeenCalledWith(
      AUTH_MESSAGES.verifyKeyText
    );
    expect(spinner.start).toHaveBeenCalledTimes(1);
    expect(spinner.succeed).toHaveBeenCalledTimes(1);
    expect(spinner.fail).not.toHaveBeenCalled();
    expect(deps.outro).toHaveBeenCalledWith(
      `${AUTH_MESSAGES.successPrefix} /tmp/.betterprompt/config.json`
    );
  });

  it("--api-key skips prompt, verifies key, and saves config", async () => {
    const deps = createDeps();

    await runAuth(["--api-key", "bp_live_from_flag"], deps);

    expect(deps.password).not.toHaveBeenCalled();
    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_live_from_flag");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("bp_live_from_flag");
  });

  it("verification failure shows error and does not save", async () => {
    const spinner = createSpinner();
    const deps = createDeps({
      createSpinner: mock(() => spinner),
      verifyApiKey: mock(async () => {
        throw new Error("API key verification failed. Unauthorized");
      }),
    });

    await runAuth(["--api-key", "bp_bad_key"], deps);

    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    expect(spinner.fail).toHaveBeenCalledTimes(1);
    const errorCalls = (deps.error as ReturnType<typeof mock>).mock.calls;
    const firstError = errorCalls[0]?.[0] as string | undefined;
    expect(firstError).toBeDefined();
    expect(firstError).toMatch(
      /Authentication failed:.*API key verification failed\. Unauthorized/
    );
    expect(deps.error).toHaveBeenCalledWith(
      `${AUTH_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/config.json`
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("empty key is rejected and does not call verify/save", async () => {
    const deps = createDeps();

    await runAuth(["--api-key", "   "], deps);

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    const errorCalls = (deps.error as ReturnType<typeof mock>).mock.calls;
    const firstError = errorCalls[0]?.[0] as string | undefined;
    expect(firstError).toBeDefined();
    expect(firstError).toMatch(
      /Authentication failed:.*API key cannot be empty\./
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("successful save prints confirmation with config path", async () => {
    const deps = createDeps({
      saveAuthConfig: mock(async () => "/tmp/custom/auth.json"),
    });

    await runAuth(["--api-key", "bp_live_123"], deps);

    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.outro).toHaveBeenCalledWith(
      `${AUTH_MESSAGES.successPrefix} /tmp/custom/auth.json`
    );
  });

  it("prompt cancellation exits without verify/save", async () => {
    const cancelToken = Symbol("cancel");
    const deps = createDeps({
      password: mock(async () => cancelToken),
      isCancel: mock((value: unknown) => value === cancelToken),
    });

    await runAuth([], deps);

    expect(deps.cancel).toHaveBeenCalledWith(AUTH_MESSAGES.cancelMessage);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("interactive whitespace key is rejected", async () => {
    const deps = createDeps({
      password: mock(async () => "   "),
    });

    await runAuth([], deps);

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    const errorCalls = (deps.error as ReturnType<typeof mock>).mock.calls;
    const firstError = errorCalls[0]?.[0] as string | undefined;
    expect(firstError).toBeDefined();
    expect(firstError).toMatch(
      /Authentication failed:.*API key cannot be empty\./
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
