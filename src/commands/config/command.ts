import {
  AUTH_MESSAGES,
  CONFIG_COMMAND,
  CONFIG_MESSAGES,
} from "../../constants";
import { ApiClient } from "../../services/api/client";
import {
  readApiKeyFromAuthConfig,
  resolveAuthConfigPath,
  saveAuthConfig,
} from "../../services/auth/service";
import { createParentCommandFromSpec } from "../../services/command-factory/service";
import {
  getSystemConfigValue,
  resolveSystemConfigPath,
  setSystemConfigValue,
  unsetSystemConfigValue,
} from "../../services/config/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createConfigGetSubcommand } from "./get/command";
import { createConfigSetSubcommand } from "./set/command";
import type { TConfigCommandDependencies, TSystemConfigKey } from "./types";
import { createConfigUnsetSubcommand } from "./unset/command";

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
    const keyList: TSystemConfigKey[] = ["apiBaseUrl"];

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
      throw new Error(
        'Cannot unset "apiKey" via config. Re-run `betterprompt auth`.'
      );
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
};

export const createConfigCommand = (
  deps: TConfigCommandDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createParentCommandFromSpec(
    {
      name: CONFIG_COMMAND.name,
      description: CONFIG_COMMAND.description,
      flags: CONFIG_COMMAND.flags,
      helpText: CONFIG_MESSAGES.helpText,
      subcommands: [
        createConfigGetSubcommand(deps, factoryDeps),
        createConfigSetSubcommand(deps, factoryDeps),
        createConfigUnsetSubcommand(deps, factoryDeps),
      ],
    },
    factoryDeps
  );

export const configCommand = createConfigCommand();
