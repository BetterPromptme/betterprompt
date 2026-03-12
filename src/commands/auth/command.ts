import { cancel, intro, isCancel, outro, password } from "@clack/prompts";
import ora from "ora";

import { AUTH_COMMAND, AUTH_MESSAGES } from "../../constants";
import {
  executeAuth,
  resolveAuthConfigPath,
  saveAuthConfig,
  verifyApiKey,
} from "../../services/auth/service";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { getCommandContext } from "../../services/context/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TAuthDependencies } from "./types";

type TAuthOpts = { apiKey?: string };

const defaultDeps: TAuthDependencies = {
  intro,
  outro,
  cancel,
  isCancel,
  password,
  verifyApiKey,
  saveAuthConfig,
  resolveAuthConfigPath,
  createSpinner: (message) => ora(message),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createAuthCommand = (
  deps: TAuthDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TAuthOpts>(
    {
      name: AUTH_COMMAND.name,
      description: AUTH_COMMAND.description,
      flags: AUTH_COMMAND.flags,
      helpText: AUTH_MESSAGES.helpText,
      customAction: (cmd, _factoryDeps) => {
        cmd.action(async (opts: TAuthOpts, command) => {
          try {
            const ctx = getCommandContext(command);
            await executeAuth(opts.apiKey, ctx, deps);
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

export const authCommand = createAuthCommand();
