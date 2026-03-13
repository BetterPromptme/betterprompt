import { intro, log, note, outro, spinner } from "@clack/prompts";

import { LOGIN_COMMAND } from "../../constants";
import { saveAuthConfig, verifyApiKey } from "../../services/auth/service";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { getCommandContext } from "../../services/context/service";
import {
  pauseGlobalSigint,
  resumeGlobalSigint,
} from "../../services/error-ux/handle";
import { openBrowser } from "../../services/login/browser";
import { startCallbackServer } from "../../services/login/callback-server";
import { executeLogin } from "../../services/login/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TLoginDependencies } from "../../types/login";

const defaultDeps: TLoginDependencies = {
  intro,
  outro,
  registerSignal: (signal, handler) => process.on(signal, handler),
  unregisterSignal: (signal, handler) => process.off(signal, handler),
  pauseGlobalSigint,
  resumeGlobalSigint,
  verifyApiKey,
  saveAuthConfig,
  startCallbackServer,
  openBrowser,
  spinner: spinner(),
  note,
  error: (message) => log.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createLoginCommand = (
  deps: TLoginDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: LOGIN_COMMAND.name,
      description: LOGIN_COMMAND.description,
      customAction: (cmd, _factoryDeps) => {
        cmd.action(async (_opts, command) => {
          try {
            const ctx = getCommandContext(command);
            await executeLogin(ctx, deps);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            deps.error(message);
            deps.setExitCode(1);
          }
        });
      },
    },
    factoryDeps
  );

export const loginCommand = createLoginCommand();
