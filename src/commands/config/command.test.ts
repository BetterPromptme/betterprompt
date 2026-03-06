import { afterEach, describe, expect, it, mock } from "bun:test";
import { CONFIG_MESSAGES } from "../../constants";
import type { TSystemConfigKey } from "../../types";
import { createConfigCommand } from "./command";

type TConfigDeps = NonNullable<Parameters<typeof createConfigCommand>[0]>;
type TConfigDepsWithUnset = TConfigDeps & {
  unsetValue: (key: TSystemConfigKey) => Promise<string>;
  getAllValues: () => Promise<Partial<Record<TSystemConfigKey, string>>>;
};

const createDeps = (
  overrides: Partial<TConfigDepsWithUnset> = {}
): TConfigDepsWithUnset => ({
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

describe("config command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("gets apiKey value", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });

    await runConfig(["get", "apiKey"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("bp_live_123"));
  });

  it("gets apiBaseUrl value", async () => {
    const deps = createDeps({
      getValue: mock(async () => "https://betterprompt.me/api"),
    });

    await runConfig(["get", "apiBaseUrl"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("https://betterprompt.me/api"));
  });

  it("outputs JSON for get when --json is provided", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });

    await runConfig(["--json", "get", "apiKey"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify({ key: "apiKey", value: "bp_live_123" })
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
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("apiKey=bp_live_123"));
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining("apiBaseUrl=https://betterprompt.me/api")
    );
  });

  it("outputs full config object in JSON mode when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({
        apiBaseUrl: "https://betterprompt.me/api",
      })),
    });

    await runConfig(["--json", "get"], deps);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify({ apiBaseUrl: "https://betterprompt.me/api" })
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

  it("sets apiKey value", async () => {
    const deps = createDeps();

    await runConfig(["set", "apiKey", "bp_live_123"], deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_live_123");
    expect(deps.setValue).toHaveBeenCalledWith("apiKey", "bp_live_123");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(CONFIG_MESSAGES.savedSuccess));
  });

  it("sets apiBaseUrl value", async () => {
    const deps = createDeps();

    await runConfig(["set", "apiBaseUrl", "https://betterprompt.me/api"], deps);

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.setValue).toHaveBeenCalledWith(
      "apiBaseUrl",
      "https://betterprompt.me/api"
    );
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(CONFIG_MESSAGES.savedSuccess));
  });

  it("outputs JSON for set when --json is provided", async () => {
    const deps = createDeps();

    await runConfig(
      ["--json", "set", "apiBaseUrl", "https://betterprompt.me/api"],
      deps
    );

    expect(deps.setValue).toHaveBeenCalledWith(
      "apiBaseUrl",
      "https://betterprompt.me/api"
    );
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify({ success: true, key: "apiBaseUrl" })
    );
  });

  it("fails and does not save when apiKey validation fails", async () => {
    const deps = createDeps({
      verifyApiKey: mock(async () => {
        throw new Error("API key verification failed. Unauthorized");
      }),
    });

    await runConfig(["set", "apiKey", "bp_bad_key"], deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_bad_key");
    expect(deps.setValue).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(2);
    expect(deps.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/auth.json`
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
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

  it("shows system config path when setting apiBaseUrl fails", async () => {
    const deps = createDeps({
      setValue: mock(async () => {
        throw new Error("write failed");
      }),
    });

    await runConfig(["set", "apiBaseUrl", "https://betterprompt.me/api"], deps);

    expect(deps.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/config.json`
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("unsets existing apiBaseUrl value", async () => {
    const deps = createDeps();

    await runConfig(["unset", "apiBaseUrl"], deps);

    expect(deps.unsetValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(CONFIG_MESSAGES.savedSuccess));
  });

  it("prints clear error when unsetting a missing key", async () => {
    const deps = createDeps({
      unsetValue: mock(async () => {
        throw new Error("apiBaseUrl is not set in config.json.");
      }),
    });

    await runConfig(["unset", "apiBaseUrl"], deps);

    expect(deps.error).toHaveBeenCalledTimes(2);
    expect(deps.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/config.json`
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
