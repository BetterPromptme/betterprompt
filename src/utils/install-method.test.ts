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
    });
  });

  it("handles execPath with version suffix like 'betterprompt-1.0.0'", () => {
    const result = detectInstallMethod({
      getExecPath: () => "/usr/local/bin/betterprompt-1.0.0",
    });

    expect(result.method).toBe("binary");
  });

  it("uses process.execPath by default", () => {
    const result = detectInstallMethod();

    expect(result.execPath).toBe(process.execPath);
  });
});
