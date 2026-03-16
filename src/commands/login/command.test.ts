import { afterEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import { LOGIN_COMMAND } from "../../constants";
import type {
  TCallbackServer,
  TLoginDependencies,
  TLoginSpinner,
} from "../../types/login";
import { createLoginCommand, loginCommand } from "./command";

const makeSpinner = (): TLoginSpinner => ({
  start: mock(() => {}),
  stop: mock(() => {}),
  message: mock(() => {}),
  cancel: mock(() => {}),
  error: mock(() => {}),
});

const makeServer = (
  overrides: Partial<TCallbackServer> = {}
): TCallbackServer => ({
  port: 3000,
  state: "abc123",
  waitForCallback: mock(() => Promise.resolve({ apiKey: "test_key" })),
  shutdown: mock(() => {}),
  ...overrides,
});

const createDeps = (
  overrides: Partial<TLoginDependencies> = {}
): TLoginDependencies => ({
  intro: mock(() => {}),
  outro: mock(() => {}),
  registerSignal: mock(() => {}),
  unregisterSignal: mock(() => {}),
  pauseGlobalSigint: mock(() => {}),
  resumeGlobalSigint: mock(() => {}),
  verifyApiKey: mock(() => Promise.resolve()),
  saveAuthConfig: mock(() => Promise.resolve("/home/.betterprompt/auth.json")),
  startCallbackServer: mock(() => Promise.resolve(makeServer())),
  openBrowser: mock(() => Promise.resolve(true)),
  spinner: makeSpinner(),
  note: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  text: mock(() => new Promise<string | symbol>(() => {})),
  isCancel: mock(() => false),
  waitForKeypress: mock(() => new Promise<"enter" | "cancel">(() => {})),
  message: mock(() => {}),
  isTTY: true,
  ...overrides,
});

describe("login command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("command.name() returns login", () => {
    const cmd = createLoginCommand(createDeps());
    expect(cmd.name()).toBe(LOGIN_COMMAND.name);
  });

  it("command.description() returns login description", () => {
    const cmd = createLoginCommand(createDeps());
    expect(cmd.description()).toBe(LOGIN_COMMAND.description);
  });

  it("parseAsync triggers executeLogin — startCallbackServer and verifyApiKey called", async () => {
    const deps = createDeps();
    const cmd = createLoginCommand(deps);
    await cmd.parseAsync([], { from: "user" });
    expect(deps.startCallbackServer).toHaveBeenCalledTimes(1);
    expect(deps.verifyApiKey).toHaveBeenCalledWith("test_key");
  });

  it("when executeLogin throws (via failing dep), deps.error and setExitCode(1) called", async () => {
    const deps = createDeps({
      startCallbackServer: mock(() =>
        Promise.reject(new Error("Server failed to start"))
      ),
    });
    const cmd = createLoginCommand(deps);
    await cmd.parseAsync([], { from: "user" });
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("createLoginCommand accepts custom deps and factoryDeps for injection", () => {
    const deps = createDeps();
    const factoryDeps = { error: mock(() => {}) };
    const cmd = createLoginCommand(deps, factoryDeps);
    expect(cmd).toBeInstanceOf(Command);
  });

  it("loginCommand export is a Command instance", () => {
    expect(loginCommand).toBeInstanceOf(Command);
  });
});
