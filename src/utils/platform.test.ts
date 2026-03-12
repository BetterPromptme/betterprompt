import { describe, expect, it } from "bun:test";

import { UPDATE_MESSAGES } from "../constants/update";
import { resolvePlatform } from "./platform";

describe("utils/platform", () => {
  it("resolves darwin/x64", () => {
    const result = resolvePlatform({
      getPlatform: () => "darwin",
      getArch: () => "x64",
    });

    expect(result).toEqual({ os: "darwin", arch: "x64" });
  });

  it("resolves linux/arm64", () => {
    const result = resolvePlatform({
      getPlatform: () => "linux",
      getArch: () => "arm64",
    });

    expect(result).toEqual({ os: "linux", arch: "arm64" });
  });

  it("resolves darwin/arm64", () => {
    const result = resolvePlatform({
      getPlatform: () => "darwin",
      getArch: () => "arm64",
    });

    expect(result).toEqual({ os: "darwin", arch: "arm64" });
  });

  it("throws for unsupported platform", () => {
    expect(() =>
      resolvePlatform({
        getPlatform: () => "win32",
        getArch: () => "x64",
      })
    ).toThrow(UPDATE_MESSAGES.unsupportedPlatform);
  });

  it("throws for unsupported architecture", () => {
    expect(() =>
      resolvePlatform({
        getPlatform: () => "linux",
        getArch: () => "ia32",
      })
    ).toThrow(UPDATE_MESSAGES.unsupportedArch);
  });
});
