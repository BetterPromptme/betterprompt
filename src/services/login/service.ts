import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type { TCliContext } from "../../types/context";
import type { TCallbackServer, TLoginDependencies } from "../../types/login";
import { createErrorFormatter } from "../error-ux/service";

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

    deps.note(LOGIN_MESSAGES.loginPrompt(url), LOGIN_MESSAGES.linkInstructions);

    s.start(LOGIN_MESSAGES.waitingForCallback);
    let apiKey: string;
    let cancelReject: ((error: Error) => void) | null = null;
    const cancelPromise = new Promise<never>((_, reject) => {
      cancelReject = reject;
    });
    const onSigint = () => {
      canceled = true;
      s.cancel(LOGIN_MESSAGES.cancelMessage);
      deps.setExitCode(1);
      server!.shutdown();
      deps.unregisterSignal("SIGINT", onSigint);
      cancelReject?.(new Error(LOGIN_MESSAGES.cancelMessage));
    };
    deps.registerSignal("SIGINT", onSigint);
    const callbackPromise = server.waitForCallback();
    callbackPromise.catch(() => {});
    try {
      const result = await Promise.race([callbackPromise, cancelPromise]);
      apiKey = result.apiKey;
      s.stop();
    } catch (error) {
      if (!canceled) {
        s.error();
      }
      throw error;
    } finally {
      deps.unregisterSignal("SIGINT", onSigint);
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
