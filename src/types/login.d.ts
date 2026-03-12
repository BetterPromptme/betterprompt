import type { TSignalHandler, TSignalName } from "./error-ux";

export type TLoginSpinner = {
  start: (message?: string) => void;
  stop: (message?: string) => void;
  message: (message?: string) => void;
  cancel: (message?: string) => void;
  error: (message?: string) => void;
};

export type TCallbackServerResult = {
  apiKey: string;
};

export type TCallbackServer = {
  port: number;
  state: string;
  waitForCallback: () => Promise<TCallbackServerResult>;
  shutdown: () => void;
};

export type THttpRequest = {
  method?: string | undefined;
  url?: string | undefined;
};

export type THttpResponse = {
  writeHead: (statusCode: number, headers?: Record<string, string>) => void;
  end: (data?: string) => void;
};

export type THttpServer = {
  listen: (port: number, hostname: string, callback: () => void) => void;
  close: (callback?: (err?: Error) => void) => void;
  closeAllConnections: () => void;
  address: () => { port: number } | null | string;
};

export type TCallbackServerDeps = {
  createServer: (
    requestListener: (req: THttpRequest, res: THttpResponse) => void
  ) => THttpServer;
  randomBytes: (size: number) => { toString: (encoding: string) => string };
  setTimeout: (
    callback: () => void,
    ms: number
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout: (
    id: ReturnType<typeof globalThis.setTimeout> | undefined
  ) => void;
};

export type TCallbackServerOptions = {
  timeoutMs?: number;
};

export type TOpenBrowserDeps = {
  platform: string;
  execFile: (
    cmd: string,
    args: string[],
    callback: (error: Error | null) => void
  ) => void;
};

export type TLoginDependencies = {
  intro: (message: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
  registerSignal: (signal: TSignalName, handler: TSignalHandler) => void;
  unregisterSignal: (signal: TSignalName, handler: TSignalHandler) => void;
  verifyApiKey: (apiKey: string) => Promise<void>;
  saveAuthConfig: (apiKey: string) => Promise<string>;
  resolveAuthConfigPath: () => string;
  startCallbackServer: (
    options?: TCallbackServerOptions
  ) => Promise<TCallbackServer>;
  openBrowser: (url: string) => Promise<boolean>;
  spinner: TLoginSpinner;
  note: (message: string, title?: string) => void;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
