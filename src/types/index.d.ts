export * from "./api";
export * from "./config";

type TPromptResult = string | symbol;

export type TAuthDependencies = {
  intro: (message: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
  isCancel: (value: unknown) => boolean;
  password: (opts: {
    message: string;
    placeholder?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  }) => Promise<TPromptResult>;
  verifyApiKey: (apiKey: string) => Promise<void>;
  saveAuthConfig: (apiKey: string) => Promise<string>;
  resolveAuthConfigPath: () => string;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

export type TSaveAuthOptions = {
  configPath?: string;
  now?: Date;
};

export type TReadAuthOptions = {
  configPath?: string;
};
