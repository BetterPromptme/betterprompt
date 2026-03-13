import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type { TCliContext } from "../../types/context";
import type { TCallbackServer, TLoginDependencies } from "../../types/login";
import { createErrorFormatter, CTRL_C_EXIT_CODE } from "../error-ux/service";

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

    s.start(LOGIN_MESSAGES.waitingForCallback);
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
    const onSigint = () => {
      canceled = true;
      s.cancel(LOGIN_MESSAGES.cancelMessage);
      deps.setExitCode(CTRL_C_EXIT_CODE);
      server!.shutdown();
      server = null;
      safeUnregister();
      cancelReject?.(new Error(LOGIN_MESSAGES.cancelMessage));
    };
    const callbackPromise = server.waitForCallback();
    callbackPromise.catch(() => {});
    try {
      deps.pauseGlobalSigint();
      deps.registerSignal("SIGINT", onSigint);
      sigintRegistered = true;
      const result = await Promise.race([callbackPromise, cancelPromise]);
      apiKey = result.apiKey;
      s.stop();
    } catch (error) {
      if (!canceled) {
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
