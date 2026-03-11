import { afterEach, describe, expect, it, mock } from "bun:test";
import { CONFIG_MESSAGES } from "../../../constants";
import type { TSystemConfigKey } from "../../../types";
import { createConfigCommand } from "../command";

type TConfigDeps = NonNullable<Parameters<typeof createConfigCommand>[0]>;

const createDeps = (overrides: Partial<TConfigDeps> = {}): TConfigDeps => ({
  getValue: mock(async () => "value"),
  getAllValues: mock(async () => ({
    apiKey: "bp_live_123",
    apiBaseUrl: "https://betterprompt.me/api",
  })),
  setValue: mock(async () => "/tmp/.betterprompt/config.json"),
  unsetValue: mock(async () => "/tmp/.betterprompt/config.json"),
  verifyApiKey: mock(async () => {}),
  resolveConfigPath: mock((key?: TSystemConfigKey) =>
    key === "apiKey"
      ? "/tmp/.betterprompt/auth.json"
      : "/tmp/.betterprompt/config.json"
  ),
  log: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runConfig = async (args: string[], deps: TConfigDeps) => {
  const command = createConfigCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("config get subcommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("gets apiKey value masked", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });

    await runConfig(["get", "apiKey"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("*******_123"));
    expect(deps.log).not.toHaveBeenCalledWith(expect.stringContaining("bp_live_123"));
  });

  it("gets apiBaseUrl value", async () => {
    const deps = createDeps({
      getValue: mock(async () => "https://betterprompt.me/api"),
    });

    await runConfig(["get", "apiBaseUrl"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("https://betterprompt.me/api"));
  });

  it("outputs JSON for get when --json is provided with masked apiKey", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });

    await runConfig(["--json", "get", "apiKey"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify({ key: "apiKey", value: "*******_123" })
    );
  });

  it("lists all config values when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({
        apiKey: "bp_live_123",
        apiBaseUrl: "https://betterprompt.me/api",
      })),
    });

    await runConfig(["get"], deps);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("apiKey=*******_123"));
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining("apiBaseUrl=https://betterprompt.me/api")
    );
  });

  it("outputs full config object in JSON mode when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({
        apiKey: "bp_live_123",
        apiBaseUrl: "https://betterprompt.me/api",
      })),
    });

    await runConfig(["--json", "get"], deps);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify({ apiKey: "*******_123", apiBaseUrl: "https://betterprompt.me/api" })
    );
  });

  it("handles empty config gracefully when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({})),
    });

    await runConfig(["get"], deps);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("No config values set.");
  });

  it("fails when key value does not exist", async () => {
    const deps = createDeps({
      getValue: mock(async () => undefined),
    });

    await runConfig(["get", "apiKey"], deps);

    expect(deps.error).toHaveBeenCalledTimes(2);
    expect(deps.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/auth.json`
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
