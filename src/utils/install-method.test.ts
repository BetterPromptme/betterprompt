import { describe, expect, it } from "bun:test";

import { detectInstallMethod } from "./install-method";

describe("utils/install-method", () => {
  it("returns 'binary' when execPath basename starts with 'betterprompt'", () => {
    const result = detectInstallMethod({
      getExecPath: () => "/usr/local/bin/betterprompt",
    });

    expect(result).toEqual({
      method: "binary",
      execPath: "/usr/local/bin/betterprompt",
      installDir: "/usr/local/bin",
      binDir: "/usr/local/bin",
    });
  });

  it("returns 'package-manager' when execPath is bun", () => {
    const result = detectInstallMethod({
      getExecPath: () => "/usr/local/bin/bun",
    });

    expect(result).toEqual({
      method: "package-manager",
      execPath: "/usr/local/bin/bun",
      installDir: "/usr/local/bin",
      binDir: "/usr/local/bin",
    });
  });

  it("returns 'package-manager' when execPath is node", () => {
    const result = detectInstallMethod({
      getExecPath: () => "/usr/bin/node",
    });

    expect(result).toEqual({
      method: "package-manager",
      execPath: "/usr/bin/node",
      installDir: "/usr/bin",
      binDir: "/usr/bin",
    });
  });

  it("handles execPath with version suffix like 'betterprompt-1.0.0'", () => {
    const result = detectInstallMethod({
      getExecPath: () => "/usr/local/bin/betterprompt-1.0.0",
    });

    expect(result.method).toBe("binary");
  });

  it("derives binDir from versioned install path", () => {
    const result = detectInstallMethod({
      getExecPath: () =>
        "/home/user/.local/share/betterprompt/versions/0.0.5/betterprompt",
    });

    expect(result).toEqual({
      method: "binary",
      execPath:
        "/home/user/.local/share/betterprompt/versions/0.0.5/betterprompt",
      installDir: "/home/user/.local/share/betterprompt/versions/0.0.5",
      binDir: "/home/user/.local/bin",
    });
  });

  it("falls back to installDir when path contains /versions/ outside expected structure", () => {
    const result = detectInstallMethod({
      getExecPath: () =>
        "/home/user/my-versions/betterprompt/1.0.0/betterprompt",
    });

    expect(result.binDir).toBe("/home/user/my-versions/betterprompt/1.0.0");
  });

  it("uses process.execPath by default", () => {
    const result = detectInstallMethod();

    expect(result.execPath).toBe(process.execPath);
  });
});
