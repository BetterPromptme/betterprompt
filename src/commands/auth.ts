import { cancel, intro, isCancel, outro, password } from "@clack/prompts";
import { Command } from "commander";
import ora from "ora";
import { AUTH_COMMAND, AUTH_MESSAGES } from "../constants";
import { getCommandContext } from "../core/context";
import { createErrorFormatter, runTaskWithSpinner } from "../core/error-ux";
import { resolveAuthConfigPath, saveAuthConfig, verifyApiKey } from "../core/auth";
import type { TAuthDependencies } from "../types";

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
  deps: TAuthDependencies = defaultDeps
): Command => {
  const command = new Command(AUTH_COMMAND.name)
    .description(AUTH_COMMAND.description)
    .option(AUTH_COMMAND.options.apiKey.flag, AUTH_COMMAND.options.apiKey.description)
    .addHelpText("after", AUTH_MESSAGES.helpText);

  command.action(async (opts: { apiKey?: string }, command: Command) => {
    deps.intro(AUTH_MESSAGES.introTitle);
    let formatError = createErrorFormatter({ color: true });

    try {
      const ctx = getCommandContext(command);
      formatError = createErrorFormatter({ color: ctx.color });

      const keyInput =
        opts.apiKey ??
        (await deps.password({
          message: AUTH_MESSAGES.passwordPrompt,
          placeholder: AUTH_MESSAGES.passwordPlaceholder,
          validate: (value: string | undefined) => {
            if (typeof value !== "string" || value.trim().length === 0) {
              return AUTH_MESSAGES.emptyKeyError;
            }

            return undefined;
          },
        }));

      if (deps.isCancel(keyInput)) {
        deps.cancel(AUTH_MESSAGES.cancelMessage);
        deps.setExitCode(1);
        return;
      }

      const apiKey = typeof keyInput === "string" ? keyInput.trim() : "";
      if (!apiKey) {
        throw new Error(AUTH_MESSAGES.emptyKeyError);
      }

      await runTaskWithSpinner({
        message: AUTH_MESSAGES.verifyKeyText,
        createSpinner: deps.createSpinner,
        task: async () => {
          await deps.verifyApiKey(apiKey);
        },
      });

      const configPath = await deps.saveAuthConfig(apiKey);
      const successMessage = `${AUTH_MESSAGES.successPrefix} ${configPath}`;
      deps.outro(successMessage);
    } catch (error) {
      const fallbackPath = deps.resolveAuthConfigPath();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      deps.error(formatError(AUTH_MESSAGES.failedPrefix, errorMessage));
      deps.error(`${AUTH_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
      deps.setExitCode(1);
    }
  });

  return command;
};

export const authCommand = createAuthCommand();
