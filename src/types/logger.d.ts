export type TLogLevel = "debug" | "info" | "warn" | "error" | "auth";

export type TLoggerVerbosity = "quiet" | "normal" | "verbose";

export type TLoggerConsole = {
  log: (message: string) => void;
  error: (message: string) => void;
};

export type TLoggerOptions = {
  rootDir: string;
  verbosity?: TLoggerVerbosity;
  console?: TLoggerConsole;
  maxFileSizeBytes?: number;
};

export type TLogger = {
  debug: (message: string) => Promise<void>;
  info: (message: string) => Promise<void>;
  warn: (message: string) => Promise<void>;
  error: (message: string) => Promise<void>;
  auth: (message: string) => Promise<void>;
};

export type TLoggerFactory = (options: TLoggerOptions) => TLogger;
