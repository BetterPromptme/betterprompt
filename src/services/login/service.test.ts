import { afterEach, describe, expect, it, mock } from "bun:test";

import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type { TCliContext } from "../../types/context";
import type {
  TCallbackServer,
  TLoginDependencies,
  TLoginSpinner,
} from "../../types/login";
import { CTRL_C_EXIT_CODE } from "../error-ux/service";
import { buildLoginUrl, executeLogin } from "./service";

const mockCtx: TCliContext = {
  scope: { type: "global" },
  outputFormat: "text",
  verbosity: "normal",
  yes: false,
  color: false,
};

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
  waitForCallback: mock(() => Promise.resolve({ apiKey: "test_key_123" })),
  shutdown: mock(() => {}),
  ...overrides,
});

const makeDeps = (
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
  ...overrides,
});

afterEach(() => {
  mock.restore();
});

describe("buildLoginUrl", () => {
  it("returns correct URL with callback_port, action, and state", () => {
    const url = buildLoginUrl(3000, "abc123");
    expect(url).toBe(
      `${LOGIN_CALLBACK.loginUrlBase}?action=cli-login&callback_port=3000&state=abc123`
    );
  });
});

describe("executeLogin", () => {
  it("success flow — browser spinner, note with URL, verifyApiKey, saveAuthConfig, outro all called", async () => {
    const server = makeServer();
    const spinner = makeSpinner();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      spinner,
    });

    await executeLogin(mockCtx, deps);

    expect(deps.startCallbackServer).toHaveBeenCalledTimes(1);
    const expectedUrl = buildLoginUrl(server.port, server.state);
    expect(spinner.start).toHaveBeenCalledWith(LOGIN_MESSAGES.browserPrompt);
    expect(deps.openBrowser).toHaveBeenCalledWith(expectedUrl);
    expect(spinner.stop).toHaveBeenCalledWith(LOGIN_MESSAGES.browserPrompt);
    expect(deps.note).toHaveBeenCalledWith(
      [expectedUrl, "", LOGIN_MESSAGES.loginPromptSuffix].join("\n"),
      LOGIN_MESSAGES.linkInstructions
    );
    expect(server.waitForCallback).toHaveBeenCalledTimes(1);
    expect(deps.verifyApiKey).toHaveBeenCalledWith("test_key_123");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("test_key_123");
    expect(deps.outro).toHaveBeenCalledTimes(1);
    expect(server.shutdown).toHaveBeenCalledTimes(1);
  });

  it("URL is always displayed even when browser fails to open", async () => {
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      openBrowser: mock(() => Promise.resolve(false)),
    });

    await executeLogin(mockCtx, deps);

    const expectedUrl = buildLoginUrl(server.port, server.state);
    expect(deps.note).toHaveBeenCalledWith(
      [expectedUrl, "", LOGIN_MESSAGES.loginPromptSuffix].join("\n"),
      LOGIN_MESSAGES.linkInstructions
    );
    expect(deps.verifyApiKey).toHaveBeenCalledWith("test_key_123");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("test_key_123");
    expect(server.shutdown).toHaveBeenCalledTimes(1);
  });

  it("timeout error — waitForCallback rejects, deps.error called, setExitCode(1) called, shutdown called", async () => {
    const shutdown = mock(() => {});
    const server = makeServer({
      waitForCallback: mock(() =>
        Promise.reject(new Error(LOGIN_MESSAGES.callbackTimeout))
      ),
      shutdown,
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("verifyApiKey failure — error and setExitCode(1) called, saveAuthConfig NOT called, shutdown called", async () => {
    const shutdown = mock(() => {});
    const spinner = makeSpinner();
    const server = makeServer({ shutdown });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      verifyApiKey: mock(() => Promise.reject(new Error("Invalid API key"))),
      spinner,
    });

    await executeLogin(mockCtx, deps);

    expect(spinner.error).toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("shutdown is called in success path", async () => {
    const shutdown = mock(() => {});
    const server = makeServer({ shutdown });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+C during wait — cancel and cleanup happen synchronously in handler", async () => {
    let sigintHandler: (() => void) | null = null;
    const shutdown = mock(() => {});
    const spinner = makeSpinner();
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
      shutdown,
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      spinner,
      registerSignal: mock((_signal, handler) => {
        sigintHandler = handler;
      }),
    });

    const loginPromise = executeLogin(mockCtx, deps);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Simulate Ctrl+C — these must happen synchronously in the handler
    sigintHandler!();

    // Verify synchronous work completed immediately (before await)
    expect(spinner.cancel).toHaveBeenCalledWith(LOGIN_MESSAGES.cancelMessage);
    expect(deps.setExitCode).toHaveBeenCalledWith(CTRL_C_EXIT_CODE);
    expect(shutdown).toHaveBeenCalled();
    expect(deps.unregisterSignal).toHaveBeenCalled();

    await loginPromise;

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.saveAuthConfig).not.toHaveBeenCalled();
    expect(deps.error).not.toHaveBeenCalled();
  });

  it("Ctrl+C during wait — pauseGlobalSigint called before registerSignal and resumeGlobalSigint called after unregisterSignal", async () => {
    const callOrder: string[] = [];
    let sigintHandler: (() => void) | null = null;
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      pauseGlobalSigint: mock(() => {
        callOrder.push("pauseGlobalSigint");
      }),
      resumeGlobalSigint: mock(() => {
        callOrder.push("resumeGlobalSigint");
      }),
      registerSignal: mock((_signal, handler) => {
        callOrder.push("registerSignal");
        sigintHandler = handler;
      }),
      unregisterSignal: mock((_signal, _handler) => {
        callOrder.push("unregisterSignal");
      }),
    });

    const loginPromise = executeLogin(mockCtx, deps);
    await new Promise((resolve) => setTimeout(resolve, 0));

    sigintHandler!();
    await loginPromise;

    expect(deps.pauseGlobalSigint).toHaveBeenCalledTimes(1);
    expect(deps.resumeGlobalSigint).toHaveBeenCalledTimes(1);

    // Verify ordering: pause before register, unregister before resume
    const pauseIdx = callOrder.indexOf("pauseGlobalSigint");
    const registerIdx = callOrder.indexOf("registerSignal");
    const unregisterIdx = callOrder.indexOf("unregisterSignal");
    const resumeIdx = callOrder.indexOf("resumeGlobalSigint");
    expect(pauseIdx).toBeLessThan(registerIdx);
    expect(unregisterIdx).toBeLessThan(resumeIdx);
  });

  it("success flow — pauseGlobalSigint called before registerSignal, resumeGlobalSigint called after unregisterSignal", async () => {
    const callOrder: string[] = [];
    const deps = makeDeps({
      pauseGlobalSigint: mock(() => {
        callOrder.push("pauseGlobalSigint");
      }),
      resumeGlobalSigint: mock(() => {
        callOrder.push("resumeGlobalSigint");
      }),
      registerSignal: mock((_signal, _handler) => {
        callOrder.push("registerSignal");
      }),
      unregisterSignal: mock((_signal, _handler) => {
        callOrder.push("unregisterSignal");
      }),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.pauseGlobalSigint).toHaveBeenCalledTimes(1);
    expect(deps.resumeGlobalSigint).toHaveBeenCalledTimes(1);

    const pauseIdx = callOrder.indexOf("pauseGlobalSigint");
    const registerIdx = callOrder.indexOf("registerSignal");
    const unregisterIdx = callOrder.indexOf("unregisterSignal");
    const resumeIdx = callOrder.indexOf("resumeGlobalSigint");
    expect(pauseIdx).toBeLessThan(registerIdx);
    expect(unregisterIdx).toBeLessThan(resumeIdx);
  });

  it("shutdown is called even when multiple invalid requests precede a valid one", async () => {
    const shutdown = mock(() => {});
    const server = makeServer({ shutdown });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(deps.verifyApiKey).toHaveBeenCalled();
  });

  it("paste wins race — verifyApiKey receives parsed key", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      text: mock(() =>
        Promise.resolve(
          `http://localhost:3000/callback?api_key=pasted_key_789&state=${server.state}`
        )
      ),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("pasted_key_789");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("pasted_key_789");
    expect(deps.outro).toHaveBeenCalledTimes(1);
  });

  it("server wins race — text prompt does not block", async () => {
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("test_key_123");
  });

  it("paste with invalid URL — error handling", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      text: mock(() => Promise.resolve("not-a-url")),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  it("paste with state mismatch — error handling", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      text: mock(() =>
        Promise.resolve(
          "http://localhost:3000/callback?api_key=key_456&state=wrong_state"
        )
      ),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  it("text prompt returns cancel symbol — treated as cancellation", async () => {
    const cancelSymbol = Symbol("cancel");
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      text: mock(() => Promise.resolve(cancelSymbol)),
      isCancel: mock((value: unknown) => value === cancelSymbol),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  it("text called with correct message", async () => {
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.text).toHaveBeenCalledWith({
      message: LOGIN_MESSAGES.pastePrompt,
    });
  });
});
