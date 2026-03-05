import { describe, expect, it, mock } from "bun:test";
import {
  createErrorFormatter,
  installCtrlCHandler,
  runTaskWithSpinner,
} from "./error-ux";

const hasAnsiEscape = (value: string): boolean =>
  value.split("").some((char) => char.charCodeAt(0) === 27);

type TSpinner = {
  start: () => TSpinner;
  succeed: (text?: string) => TSpinner;
  fail: (text?: string) => TSpinner;
};

const createSpinner = (): TSpinner => {
  const spinner = {} as TSpinner;
  spinner.start = mock(() => spinner);
  spinner.succeed = mock(() => spinner);
  spinner.fail = mock(() => spinner);
  return spinner;
};

describe("error ux", () => {
  it("formats errors with ANSI color when color is enabled", () => {
    const formatError = createErrorFormatter({ color: true });

    const formatted = formatError("Auth command failed:", "Invalid API key");

    expect(formatted).toContain("Auth command failed:");
    expect(formatted).toContain("Invalid API key");
    expect(hasAnsiEscape(formatted)).toBe(true);
  });

  it("starts spinner and marks success when task resolves", async () => {
    const spinner = createSpinner();
    const task = mock(async () => "ok");

    const result = await runTaskWithSpinner({
      message: "Checking network...",
      createSpinner: mock(() => spinner),
      task,
    });

    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
    expect(spinner.start).toHaveBeenCalledTimes(1);
    expect(spinner.succeed).toHaveBeenCalledTimes(1);
    expect(spinner.fail).not.toHaveBeenCalled();
  });

  it("starts spinner and marks failure when task rejects", async () => {
    const spinner = createSpinner();
    const task = mock(async () => {
      throw new Error("Registry unreachable");
    });

    await expect(
      runTaskWithSpinner({
        message: "Checking network...",
        createSpinner: mock(() => spinner),
        task,
      })
    ).rejects.toThrow("Registry unreachable");

    expect(task).toHaveBeenCalledTimes(1);
    expect(spinner.start).toHaveBeenCalledTimes(1);
    expect(spinner.succeed).not.toHaveBeenCalled();
    expect(spinner.fail).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+C handler performs cleanup and sets graceful exit code", () => {
    const cleanup = mock(() => {});
    const setExitCode = mock(() => {});
    const log = mock(() => {});

    let registeredHandler: (() => void) | undefined;
    const register = mock((_signal: "SIGINT", handler: () => void) => {
      registeredHandler = handler;
    });
    const unregister = mock(() => {});

    const uninstall = installCtrlCHandler({
      register,
      unregister,
      cleanup,
      setExitCode,
      log,
    });

    expect(registeredHandler).toBeDefined();
    registeredHandler?.();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(setExitCode).toHaveBeenCalledWith(130);
    expect(log).toHaveBeenCalledWith(
      "Interrupted (Ctrl+C). Exiting gracefully."
    );

    uninstall();
    expect(unregister).toHaveBeenCalledWith("SIGINT", registeredHandler);
  });
});
