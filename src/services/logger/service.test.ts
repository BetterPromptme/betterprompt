import { describe, expect, it, mock } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  TLogger,
  TLoggerConsole,
  TLoggerFactory,
  TLoggerOptions,
} from "../../types/logger";
import { createLogger } from "./service";

const createTempRoot = async (): Promise<string> =>
  mkdtemp(path.join(os.tmpdir(), "betterprompt-logger-"));

const getLogsDir = (rootDir: string): string => path.join(rootDir, "logs");

const readLog = async (rootDir: string, fileName: string): Promise<string> =>
  readFile(path.join(getLogsDir(rootDir), fileName), "utf8");

const createLoggerForTest = (
  rootDir: string,
  verbosity: TLoggerOptions["verbosity"],
  consoleLike: TLoggerConsole,
  maxFileSizeBytes?: number
): TLogger =>
  (createLogger as unknown as TLoggerFactory)({
    rootDir,
    verbosity,
    console: consoleLike,
    ...(maxFileSizeBytes !== undefined && { maxFileSizeBytes }),
  });

describe("logger core", () => {
  it("writes info/warn/error events to cli.log", async () => {
    const rootDir = await createTempRoot();

    try {
      const logger = createLoggerForTest(rootDir, "normal", {
        log: mock(() => {}),
        error: mock(() => {}),
      });

      await logger.info("build started");
      await logger.warn("using fallback model");
      await logger.error("request failed");

      const cliLog = await readLog(rootDir, "cli.log");
      expect(cliLog).toContain("build started");
      expect(cliLog).toContain("using fallback model");
      expect(cliLog).toContain("request failed");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes auth-related events to auth.log", async () => {
    const rootDir = await createTempRoot();

    try {
      const logger = createLoggerForTest(rootDir, "normal", {
        log: mock(() => {}),
        error: mock(() => {}),
      });

      await logger.auth("api key verified");

      const authLog = await readLog(rootDir, "auth.log");
      expect(authLog).toContain("api key verified");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes error events to errors.log", async () => {
    const rootDir = await createTempRoot();

    try {
      const logger = createLoggerForTest(rootDir, "normal", {
        log: mock(() => {}),
        error: mock(() => {}),
      });

      await logger.error("network timeout");

      const errorsLog = await readLog(rootDir, "errors.log");
      expect(errorsLog).toContain("network timeout");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enables debug-level console output when verbosity is verbose", async () => {
    const rootDir = await createTempRoot();

    try {
      const consoleLike = {
        log: mock(() => {}),
        error: mock(() => {}),
      };
      const logger = createLoggerForTest(rootDir, "verbose", consoleLike);

      await logger.debug("resolved input schema");

      expect(consoleLike.log).toHaveBeenCalledWith(
        expect.stringContaining("resolved input schema")
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("suppresses non-essential console output when verbosity is quiet", async () => {
    const rootDir = await createTempRoot();

    try {
      const consoleLike = {
        log: mock(() => {}),
        error: mock(() => {}),
      };
      const logger = createLoggerForTest(rootDir, "quiet", consoleLike);

      await logger.info("started");
      await logger.warn("fallback");
      await logger.error("fatal");

      expect(consoleLike.log).not.toHaveBeenCalled();
      expect(consoleLike.error).toHaveBeenCalledWith(expect.stringContaining("fatal"));
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates log files when they are missing", async () => {
    const rootDir = await createTempRoot();

    try {
      const logger = createLoggerForTest(rootDir, "normal", {
        log: mock(() => {}),
        error: mock(() => {}),
      });

      await logger.info("bootstrap log files");

      await expect(access(path.join(getLogsDir(rootDir), "cli.log"))).resolves.toBeNull();
      await expect(access(path.join(getLogsDir(rootDir), "auth.log"))).resolves.toBeNull();
      await expect(access(path.join(getLogsDir(rootDir), "errors.log"))).resolves.toBeNull();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rotates log file when size exceeds limit", async () => {
    const rootDir = await createTempRoot();

    try {
      const logger = createLoggerForTest(
        rootDir,
        "normal",
        {
          log: mock(() => {}),
          error: mock(() => {}),
        },
        150
      );

      await logger.info("x".repeat(100));
      await logger.info("y".repeat(100));

      const rotatedLog = await readLog(rootDir, "cli.log.1");
      const activeLog = await readLog(rootDir, "cli.log");

      expect(rotatedLog).toContain("x".repeat(100));
      expect(activeLog).toContain("y".repeat(100));
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
