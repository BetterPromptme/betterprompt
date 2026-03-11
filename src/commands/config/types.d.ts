import type { TSystemConfigKey } from "../../types/config";

export type TConfigCommandDependencies = {
  getValue: (key: TSystemConfigKey) => Promise<string | undefined>;
  getAllValues: () => Promise<Partial<Record<TSystemConfigKey, string>>>;
  setValue: (key: TSystemConfigKey, value: string) => Promise<string>;
  unsetValue: (key: TSystemConfigKey) => Promise<string>;
  verifyApiKey: (apiKey: string) => Promise<void>;
  resolveConfigPath: (key?: TSystemConfigKey) => string;
};

export type TConfigSubcommandOpts = { json?: boolean };

export type { TSystemConfigKey };
