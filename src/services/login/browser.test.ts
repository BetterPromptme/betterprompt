import { afterEach, describe, expect, it, mock } from "bun:test";

import type { TOpenBrowserDeps } from "../../types/login";
import { openBrowser } from "./browser";

// Helper to create a mock execFile that immediately calls callback
function makeExecFile(error: Error | null = null) {
  return mock(
    (
      _cmd: string,
      _args: string[],
      callback: (error: Error | null) => void
    ) => {
      callback(error);
    }
  );
}

afterEach(() => {
  mock.restore();
});

describe("openBrowser", () => {
  it("calls 'open' on macOS (darwin)", async () => {
    const execFile = makeExecFile();
    const deps: TOpenBrowserDeps = { platform: "darwin", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][0]).toBe("open");
    expect(execFile.mock.calls[0][1]).toEqual(["https://example.com"]);
    expect(result).toBe(true);
  });

  it("calls 'xdg-open' on Linux", async () => {
    const execFile = makeExecFile();
    const deps: TOpenBrowserDeps = { platform: "linux", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][0]).toBe("xdg-open");
    expect(execFile.mock.calls[0][1]).toEqual(["https://example.com"]);
    expect(result).toBe(true);
  });

  it("calls 'cmd /c start <url>' on Windows (win32)", async () => {
    const execFile = makeExecFile();
    const deps: TOpenBrowserDeps = { platform: "win32", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][0]).toBe("cmd");
    expect(execFile.mock.calls[0][1]).toEqual([
      "/c",
      "start",
      "https://example.com",
    ]);
    expect(result).toBe(true);
  });

  it("returns true when execFile succeeds (callback with no error)", async () => {
    const execFile = makeExecFile(null);
    const deps: TOpenBrowserDeps = { platform: "darwin", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(result).toBe(true);
  });

  it("returns false when execFile fails (callback with error)", async () => {
    const execFile = makeExecFile(new Error("spawn error"));
    const deps: TOpenBrowserDeps = { platform: "darwin", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(result).toBe(false);
  });

  it("returns false on unknown/unsupported platform (e.g. 'freebsd')", async () => {
    const execFile = makeExecFile();
    const deps: TOpenBrowserDeps = { platform: "freebsd", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(execFile).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("never throws — all error paths return false", async () => {
    const execFile = mock(
      (
        _cmd: string,
        _args: string[],
        _callback: (error: Error | null) => void
      ) => {
        throw new Error("unexpected throw");
      }
    );
    const deps: TOpenBrowserDeps = { platform: "darwin", execFile };

    const result = await openBrowser("https://example.com", deps);

    expect(result).toBe(false);
  });
});
