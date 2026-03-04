import { Command, InvalidArgumentError } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { AUTH_MESSAGES, CONFIG_COMMAND, CONFIG_MESSAGES } from "../constants";
import { ApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import {
  getSystemConfigValue,
  resolveSystemConfigPath,
  setSystemConfigValue,
} from "../core/config";
import {
  readApiKeyFromAuthConfig,
  resolveAuthConfigPath,
  saveAuthConfig,
} from "../core/auth";
import type { TSystemConfigKey } from "../types";

type TConfigCommandDependencies = {
  getValue: (key: TSystemConfigKey) => Promise<string | undefined>;
  setValue: (key: TSystemConfigKey, value: string) => Promise<string>;
  verifyApiKey: (apiKey: string) => Promise<void>;
  resolveConfigPath: (key: TSystemConfigKey) => string;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TConfigCommandDependencies = {
  getValue: async (key) => {
    if (key === "apiKey") {
      return readApiKeyFromAuthConfig().catch(() => undefined);
    }
    return getSystemConfigValue(key);
  },
  setValue: async (key, value) => {
    if (key === "apiKey") {
      return saveAuthConfig(value);
    }
    return setSystemConfigValue(key, value);
  },
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
  resolveConfigPath: (key) =>
    key === "apiKey" ? resolveAuthConfigPath() : resolveSystemConfigPath(),
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
    .option("--json", "Render output as JSON")
    .addHelpText("after", CONFIG_MESSAGES.helpText);

  command
    .command("get")
    .description(CONFIG_COMMAND.get.description)
    .argument("<key>", CONFIG_COMMAND.get.keyDescription, parseConfigKey)
    .action(async (key: TSystemConfigKey, _opts: Record<string, unknown>, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const value = await deps.getValue(key);
        if (typeof value !== "string" || !value.trim()) {
          throw new Error(CONFIG_MESSAGES.missingValueError(key));
        }
        if (ctx.outputFormat === "json") {
          deps.log(JSON.stringify({ key, value }));
        } else {
          deps.log(`${logSymbols.info} ${value}`);
        }
      } catch (error) {
        const fallbackPath = deps.resolveConfigPath(key);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.error(`${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
        deps.setExitCode(1);
      }
    });

  command
    .command("set")
    .description(CONFIG_COMMAND.set.description)
    .argument("<key>", CONFIG_COMMAND.set.keyDescription, parseConfigKey)
    .argument("<value>", CONFIG_COMMAND.set.valueDescription)
    .action(
      async (
        key: TSystemConfigKey,
        value: string,
        _opts: Record<string, unknown>,
        command: Command
      ) => {
      try {
        const ctx = getCommandContext(command);
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
        if (ctx.outputFormat === "json") {
          deps.log(JSON.stringify({ success: true, key }));
        } else {
          deps.log(`${logSymbols.success} ${CONFIG_MESSAGES.savedSuccess}`);
        }
      } catch (error) {
        const fallbackPath = deps.resolveConfigPath(key);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${CONFIG_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.error(`${CONFIG_MESSAGES.failedNoChangesPrefix} ${fallbackPath}`);
        deps.setExitCode(1);
      }
    }
    );

  return command;
};

export const configCommand = createConfigCommand();
