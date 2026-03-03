import { Command, InvalidArgumentError } from "commander";
import ora from "ora";
import { AUTH_MESSAGES, CONFIG_COMMAND, CONFIG_MESSAGES } from "../constants";
import { ApiClient } from "../core/api";
import {
  getSystemConfigValue,
  resolveSystemConfigPath,
  setSystemConfigValue,
} from "../core/config";
import type { TSystemConfigKey } from "../types";

type TConfigCommandDependencies = {
  getValue: (key: TSystemConfigKey) => Promise<string | undefined>;
  setValue: (key: TSystemConfigKey, value: string) => Promise<string>;
  verifyApiKey: (apiKey: string) => Promise<void>;
  resolveConfigPath: () => string;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TConfigCommandDependencies = {
  getValue: getSystemConfigValue,
  setValue: setSystemConfigValue,
  verifyApiKey: async (apiKey: string) => {
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey) {
      throw new Error(AUTH_MESSAGES.emptyKeyError);
    }

    const client = new ApiClient({
      getApiKey: () => normalizedApiKey,
    });
    await client.get("/me");
  },
  resolveConfigPath: () => resolveSystemConfigPath(),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const parseConfigKey = (value: string): TSystemConfigKey => {
  if (value === "apiKey" || value === "apiBaseUrl") {
    return value;
  }

  throw new InvalidArgumentError(CONFIG_MESSAGES.invalidKeyError(value));
};

export const createConfigCommand = (
  deps: TConfigCommandDependencies = defaultDeps
): Command => {
  const command = new Command(CONFIG_COMMAND.name)
    .description(CONFIG_COMMAND.description)
    .addHelpText("after", CONFIG_MESSAGES.helpText);

  command
    .command("get")
    .description(CONFIG_COMMAND.get.description)
    .argument("<key>", CONFIG_COMMAND.get.keyDescription, parseConfigKey)
    .action(async (key: TSystemConfigKey) => {
      try {
        const value = await deps.getValue(key);
        if (typeof value !== "string" || !value.trim()) {
          throw new Error(CONFIG_MESSAGES.missingValueError(key));
        }
        deps.log(value);
      } catch (error) {
        const fallbackPath = deps.resolveConfigPath();
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(`${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.error(`${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
        deps.setExitCode(1);
      }
    });

  command
    .command("set")
    .description(CONFIG_COMMAND.set.description)
    .argument("<key>", CONFIG_COMMAND.set.keyDescription, parseConfigKey)
    .argument("<value>", CONFIG_COMMAND.set.valueDescription)
    .action(async (key: TSystemConfigKey, value: string) => {
      try {
        if (key === "apiKey") {
          const spinner = ora(CONFIG_MESSAGES.verifyingApiKey).start();
          try {
            await deps.verifyApiKey(value);
            spinner.succeed(CONFIG_MESSAGES.verifiedApiKey);
          } catch (error) {
            spinner.fail(CONFIG_MESSAGES.failedVerifyApiKey);
            throw error;
          }
        }

        await deps.setValue(key, value);
        deps.log(CONFIG_MESSAGES.savedSuccess);
      } catch (error) {
        const fallbackPath = deps.resolveConfigPath();
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(`${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.error(`${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
        deps.setExitCode(1);
      }
    });

  return command;
};

export const configCommand = createConfigCommand();
