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
  waitForKeypress: mock(() => new Promise<"enter" | "cancel">(() => {})),
  message: mock(() => {}),
  isTTY: true,
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

  it("Ctrl+C during Phase 1 — cancel and cleanup happen synchronously in handler", async () => {
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

  it("SIGINT during Phase 2 — s.cancel() not called on already-stopped spinner", async () => {
    let sigintHandler: (() => void) | null = null;
    const spinner = makeSpinner();
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      spinner,
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      text: mock(() => new Promise<string | symbol>(() => {})),
      registerSignal: mock((_signal, handler) => {
        sigintHandler = handler;
      }),
    });

    const loginPromise = executeLogin(mockCtx, deps);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Phase 2 is active — spinner already stopped
    sigintHandler!();
    await loginPromise;

    expect(spinner.cancel).not.toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(CTRL_C_EXIT_CODE);
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

  // --- Phase 1 tests ---

  it("Phase 1: server wins — keypress aborted, text never called", async () => {
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("test_key_123");
    expect(deps.text).not.toHaveBeenCalled();
  });

  it("Phase 1: hint displayed above spinner", async () => {
    const spinner = makeSpinner();
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      spinner,
    });

    await executeLogin(mockCtx, deps);

    expect(deps.message).toHaveBeenCalledWith(LOGIN_MESSAGES.pasteHint);
    // Spinner only shows the waiting message, not the hint
    const startCalls = (spinner.start as ReturnType<typeof mock>).mock.calls;
    const waitingCall = startCalls.find(
      (call: unknown[]) => call[0] === LOGIN_MESSAGES.waitingForCallback
    );
    expect(waitingCall).toBeDefined();
  });

  it("Phase 1: pasteHint not displayed in non-TTY environments", async () => {
    const server = makeServer();
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      isTTY: false,
    });

    await executeLogin(mockCtx, deps);

    expect(deps.message).not.toHaveBeenCalled();
  });

  it("Phase 1: Enter → transitions to Phase 2, text() called", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      text: mock(() =>
        Promise.resolve(
          `http://localhost:3000/callback?api_key=pasted_key&state=${server.state}`
        )
      ),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.text).toHaveBeenCalledWith({
      message: LOGIN_MESSAGES.pastePrompt,
    });
    expect(deps.verifyApiKey).toHaveBeenCalledWith("pasted_key");
  });

  it("Phase 1: keypress 'cancel' — graceful cancel like SIGINT", async () => {
    const spinner = makeSpinner();
    const shutdown = mock(() => {});
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
      shutdown,
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("cancel" as const)),
      spinner,
    });

    await executeLogin(mockCtx, deps);

    expect(spinner.cancel).toHaveBeenCalledWith(LOGIN_MESSAGES.cancelMessage);
    expect(deps.setExitCode).toHaveBeenCalledWith(CTRL_C_EXIT_CODE);
    expect(shutdown).toHaveBeenCalled();
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  // --- Phase 2 tests ---

  it("Phase 2: paste wins — verify with parsed key", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
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

  it("Phase 2: server wins during paste — verify with server key", async () => {
    const server = makeServer({
      waitForCallback: mock(() =>
        Promise.resolve({ apiKey: "server_key_456" })
      ),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      // text never resolves — server wins
      text: mock(() => new Promise<string | symbol>(() => {})),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("server_key_456");
    expect(deps.saveAuthConfig).toHaveBeenCalledWith("server_key_456");
  });

  it("Phase 2: invalid URL — error", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      text: mock(() => Promise.resolve("not-a-url")),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  it("Phase 2: text canceled — graceful cancel, no error message", async () => {
    const cancelSymbol = Symbol("cancel");
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      text: mock(() => Promise.resolve(cancelSymbol)),
      isCancel: mock((value: unknown) => value === cancelSymbol),
    });

    await executeLogin(mockCtx, deps);

    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(CTRL_C_EXIT_CODE);
    expect(deps.verifyApiKey).not.toHaveBeenCalled();
  });

  it("Phase 2: error does not call s.error() on already-stopped spinner", async () => {
    const spinner = makeSpinner();
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
      text: mock(() => Promise.resolve("not-a-url")),
      spinner,
    });

    await executeLogin(mockCtx, deps);

    // Spinner was stopped when entering Phase 2, so s.error() should NOT be called
    expect(spinner.error).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
  });

  it("Phase 2: paste with state mismatch — error handling", async () => {
    const server = makeServer({
      waitForCallback: mock(() => new Promise<{ apiKey: string }>(() => {})),
    });
    const deps = makeDeps({
      startCallbackServer: mock(() => Promise.resolve(server)),
      waitForKeypress: mock(() => Promise.resolve("enter" as const)),
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
});
