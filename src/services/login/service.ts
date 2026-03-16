import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type { TCliContext } from "../../types/context";
import type { TCallbackServer, TLoginDependencies } from "../../types/login";
import { createErrorFormatter, CTRL_C_EXIT_CODE } from "../error-ux/service";
import { parseCallbackUrl } from "./parse-callback-url";

export const buildLoginUrl = (port: number, state: string): string => {
  const params = new URLSearchParams();
  params.append(LOGIN_CALLBACK.queryParams.action, LOGIN_CALLBACK.loginAction);
  params.append(LOGIN_CALLBACK.queryParams.callbackPort, String(port));
  params.append(LOGIN_CALLBACK.queryParams.state, state);
  return `${LOGIN_CALLBACK.loginUrlBase}?${params.toString()}`;
};

export const executeLogin = async (
  ctx: TCliContext,
  deps: TLoginDependencies
): Promise<void> => {
  deps.intro(LOGIN_MESSAGES.introTitle);
  const formatError = createErrorFormatter({ color: ctx.color });
  const s = deps.spinner;
  let server: TCallbackServer | null = null;
  let canceled = false;

  try {
    server = await deps.startCallbackServer();
    const url = buildLoginUrl(server.port, server.state);

    s.start(LOGIN_MESSAGES.browserPrompt);
    await deps.openBrowser(url);
    s.stop(LOGIN_MESSAGES.browserPrompt);

    deps.note(
      [url, "", LOGIN_MESSAGES.loginPromptSuffix].join("\n"),
      LOGIN_MESSAGES.linkInstructions
    );

    let apiKey: string;
    let cancelReject: ((error: Error) => void) | null = null;
    const cancelPromise = new Promise<never>((_, reject) => {
      cancelReject = reject;
    });
    let sigintRegistered = false;
    const safeUnregister = () => {
      if (!sigintRegistered) return;
      sigintRegistered = false;
      deps.unregisterSignal("SIGINT", onSigint);
    };

    const callbackPromise = server.waitForCallback();
    callbackPromise.catch(() => {});
    const serverState = server.state;

    const abortController = new AbortController();
    const keypressPromise = deps.waitForKeypress(abortController.signal);
    keypressPromise.catch(() => {});

    if (deps.isTTY) {
      deps.message(LOGIN_MESSAGES.pasteHint);
    }
    s.start(LOGIN_MESSAGES.waitingForCallback);
    let spinnerActive = true;

    const onSigint = () => {
      canceled = true;
      if (spinnerActive) {
        s.cancel(LOGIN_MESSAGES.cancelMessage);
        spinnerActive = false;
      }
      deps.setExitCode(CTRL_C_EXIT_CODE);
      abortController.abort();
      server?.shutdown();
      server = null;
      safeUnregister();
      cancelReject?.(new Error(LOGIN_MESSAGES.cancelMessage));
    };

    const gracefulCancel = () => {
      canceled = true;
      if (spinnerActive) {
        s.cancel(LOGIN_MESSAGES.cancelMessage);
        spinnerActive = false;
      }
      deps.setExitCode(CTRL_C_EXIT_CODE);
      server?.shutdown();
      server = null;
    };

    try {
      deps.pauseGlobalSigint();
      deps.registerSignal("SIGINT", onSigint);
      sigintRegistered = true;

      // Phase 1: Race server callback vs keypress vs cancel
      const phase1Result = await Promise.race([
        callbackPromise.then((r) => ({
          source: "server" as const,
          apiKey: r.apiKey,
        })),
        keypressPromise.then((key) => ({
          source: "keypress" as const,
          key,
        })),
        cancelPromise,
      ]);

      if (phase1Result.source === "server") {
        // Server won Phase 1 — abort keypress, done
        abortController.abort();
        s.stop();
        spinnerActive = false;
        apiKey = phase1Result.apiKey;
      } else if (
        phase1Result.source === "keypress" &&
        phase1Result.key === "cancel"
      ) {
        gracefulCancel();
        throw new Error(LOGIN_MESSAGES.cancelMessage);
      } else {
        // Enter pressed — transition to Phase 2
        s.stop();
        spinnerActive = false;

        const textPromise = deps.text({
          message: LOGIN_MESSAGES.pastePrompt,
        });
        textPromise.catch(() => {});

        const phase2Result = await Promise.race([
          callbackPromise.then((r) => ({
            source: "server" as const,
            apiKey: r.apiKey,
          })),
          textPromise.then((value) => ({
            source: "paste" as const,
            value,
          })),
          cancelPromise,
        ]);

        if (phase2Result.source === "paste") {
          if (deps.isCancel(phase2Result.value)) {
            canceled = true;
            deps.setExitCode(CTRL_C_EXIT_CODE);
            throw new Error(LOGIN_MESSAGES.cancelMessage);
          }
          const parsed = parseCallbackUrl(phase2Result.value, serverState);
          apiKey = parsed.apiKey;
        } else {
          apiKey = phase2Result.apiKey;
        }
      }
    } catch (error) {
      if (!canceled && spinnerActive) {
        s.error();
      }
      throw error;
    } finally {
      safeUnregister();
      deps.resumeGlobalSigint();
    }

    s.start(LOGIN_MESSAGES.verifyKeyText);
    try {
      await deps.verifyApiKey(apiKey);
      s.stop(LOGIN_MESSAGES.verifyKeyText);
    } catch (error) {
      s.error();
      throw error;
    }

    const configPath = await deps.saveAuthConfig(apiKey);
    deps.outro(`${LOGIN_MESSAGES.successPrefix} ${configPath}`);
  } catch (error) {
    if (canceled) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    deps.error(formatError(LOGIN_MESSAGES.failedPrefix, message));
    deps.setExitCode(1);
  } finally {
    server?.shutdown();
  }
};
