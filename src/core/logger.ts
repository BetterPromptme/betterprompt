import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  TLogLevel,
  TLogger,
  TLoggerFactory,
  TLoggerOptions,
  TLoggerVerbosity,
} from "../types/logger";

const DEFAULT_MAX_LOG_FILE_SIZE_BYTES = 1024 * 1024;
const BASE_LOG_FILES = ["cli.log", "auth.log", "errors.log"] as const;

const formatLogLine = (level: TLogLevel, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
};

const resolveLogFilesForLevel = (level: TLogLevel): string[] => {
  if (level === "auth") {
    return ["auth.log"];
  }

  if (level === "error") {
    return ["cli.log", "errors.log"];
  }

  return ["cli.log"];
};

const shouldWriteToConsole = (
  level: TLogLevel,
  verbosity: TLoggerVerbosity
): boolean => {
  if (verbosity === "quiet") {
    return level === "error";
  }

  if (level === "debug") {
    return verbosity === "verbose";
  }

  return level === "info" || level === "warn" || level === "error";
};

const rotateIfNeeded = async (
  filePath: string,
  incomingLine: string,
  maxFileSizeBytes: number
): Promise<void> => {
  const incomingSize = Buffer.byteLength(incomingLine, "utf8");

  try {
    const currentStats = await stat(filePath);
    const nextSize = currentStats.size + incomingSize;
    if (nextSize <= maxFileSizeBytes) {
      return;
    }

    const rotatedPath = `${filePath}.1`;
    await rm(rotatedPath, { force: true });
    await rename(filePath, rotatedPath);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }
};

const writeLogLine = async (
  logsDir: string,
  fileName: string,
  line: string,
  maxFileSizeBytes: number
): Promise<void> => {
  const filePath = path.join(logsDir, fileName);
  await rotateIfNeeded(filePath, line, maxFileSizeBytes);
  await writeFile(filePath, line, { flag: "a" });
};

const ensureBaseLogFiles = async (logsDir: string): Promise<void> => {
  await mkdir(logsDir, { recursive: true });

  for (const fileName of BASE_LOG_FILES) {
    const filePath = path.join(logsDir, fileName);
    await writeFile(filePath, "", { flag: "a" });
  }
};

const writeToConsole = (
  level: TLogLevel,
  message: string,
  loggerConsole: Required<TLoggerOptions>["console"]
): void => {
  if (level === "error") {
    loggerConsole.error(message);
    return;
  }

  loggerConsole.log(message);
};

export const createLogger: TLoggerFactory = (options): TLogger => {
  const verbosity = options.verbosity ?? "normal";
  const loggerConsole = options.console ?? console;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_LOG_FILE_SIZE_BYTES;
  const logsDir = path.join(options.rootDir, "logs");
  const initPromise = ensureBaseLogFiles(logsDir);

  const log = async (level: TLogLevel, message: string): Promise<void> => {
    await initPromise;
    const line = formatLogLine(level, message);
    const targetFiles = resolveLogFilesForLevel(level);

    for (const fileName of targetFiles) {
      await writeLogLine(logsDir, fileName, line, maxFileSizeBytes);
    }

    if (shouldWriteToConsole(level, verbosity)) {
      writeToConsole(level, message, loggerConsole);
    }
  };

  return {
    debug: (message) => log("debug", message),
    info: (message) => log("info", message),
    warn: (message) => log("warn", message),
    error: (message) => log("error", message),
    auth: (message) => log("auth", message),
  };
};
