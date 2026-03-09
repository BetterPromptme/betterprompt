import { Command, InvalidArgumentError } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { AUTH_MESSAGES, CONFIG_COMMAND, CONFIG_MESSAGES } from "../../constants";
import { ApiClient } from "../../services/api/client";
import { getCommandContext } from "../../services/context/service";
import {
  getSystemConfigValue,
  resolveSystemConfigPath,
  setSystemConfigValue,
  unsetSystemConfigValue,
} from "../../services/config/service";
import {
  readApiKeyFromAuthConfig,
  resolveAuthConfigPath,
  saveAuthConfig,
} from "../../services/auth/service";
import type { TConfigCommandDependencies, TSystemConfigKey } from "./types";

const defaultDeps: TConfigCommandDependencies = {
  getValue: async (key) => {
    if (key === "apiKey") {
      return readApiKeyFromAuthConfig().catch(() => undefined);
    }
    return getSystemConfigValue(key);
  },
  getAllValues: async () => {
    const values: Partial<Record<TSystemConfigKey, string>> = {};
    const apiKey = await readApiKeyFromAuthConfig().catch(() => undefined);
    if (typeof apiKey === "string" && apiKey.trim()) {
      values.apiKey = apiKey;
    }
    const keyList: TSystemConfigKey[] = [
      "apiBaseUrl",
    ];

    for (const key of keyList) {
      const currentValue = await getSystemConfigValue(key);
      if (typeof currentValue === "string" && currentValue.trim()) {
        values[key] = currentValue;
      }
    }
    return values;
  },
  setValue: async (key, value) => {
    if (key === "apiKey") {
      return saveAuthConfig(value);
    }
    return setSystemConfigValue(key, value);
  },
  unsetValue: async (key) => {
    if (key === "apiKey") {
      throw new Error('Cannot unset "apiKey" via config. Re-run `betterprompt auth`.');
    }
    return unsetSystemConfigValue(key);
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
  resolveConfigPath: (key) => {
    if (key === "apiKey") {
      return resolveAuthConfigPath();
    }
    return resolveSystemConfigPath();
  },
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const parseConfigKey = (value: string): TSystemConfigKey => {
  if (
    value === "apiKey" ||
    value === "apiBaseUrl"
  ) {
    return value;
  }

  throw new InvalidArgumentError(CONFIG_MESSAGES.invalidKeyError(value));
};

export const createConfigCommand = (
  deps: TConfigCommandDependencies = defaultDeps
): Command => {
  const configGet = CONFIG_COMMAND.subcommands.get;
  const configSet = CONFIG_COMMAND.subcommands.set;
  const configUnset = CONFIG_COMMAND.subcommands.unset;

  const command = new Command(CONFIG_COMMAND.name)
    .description(CONFIG_COMMAND.description)
    .option(CONFIG_COMMAND.flags.json.flag, CONFIG_COMMAND.flags.json.description)
    .addHelpText("after", CONFIG_MESSAGES.helpText);

  command
    .command(configGet.name)
    .description(configGet.description)
    .usage("[options] [<key>]")
    .option(configGet.flags.json.flag, configGet.flags.json.description)
    .argument(configGet.arguments.key.name, configGet.arguments.key.description, parseConfigKey)
    .action(async (key: TSystemConfigKey | undefined, _opts: Record<string, unknown>, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        if (!key) {
          const values = await deps.getAllValues();
          const entries = Object.entries(values).filter(
            ([, value]) => typeof value === "string" && value.trim()
          );

          if (ctx.outputFormat === "json") {
            deps.log(JSON.stringify(values));
            return;
          }

          if (!entries.length) {
            deps.log("No config values set.");
            return;
          }

          for (const [entryKey, value] of entries) {
            deps.log(`${entryKey}=${value}`);
          }
          return;
        }

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
    .command(configSet.name)
    .description(configSet.description)
    .argument(configSet.arguments.key.name, configSet.arguments.key.description, parseConfigKey)
    .argument(configSet.arguments.value.name, configSet.arguments.value.description)
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

  command
    .command(configUnset.name)
    .description(configUnset.description)
    .argument(configUnset.arguments.key.name, configUnset.arguments.key.description, parseConfigKey)
    .action(
      async (
        key: TSystemConfigKey,
        _opts: Record<string, unknown>,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          await deps.unsetValue(key);
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
