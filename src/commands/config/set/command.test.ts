import { afterEach, describe, expect, it, mock } from "bun:test";

import { CONFIG_MESSAGES } from "../../../constants";
import { createFactoryDeps } from "../../../services/command-factory/test-helpers";
import type { TSystemConfigKey } from "../../../types";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
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
  ...overrides,
});

const runConfig = async (
  args: string[],
  deps: TConfigDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const command = createConfigCommand(deps, factoryDeps);
  await command.parseAsync(args, { from: "user" });
};

describe("config set subcommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("sets apiKey value", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runConfig(["set", "apiKey", "bp_live_123"], deps, factory);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_live_123");
    expect(deps.setValue).toHaveBeenCalledWith("apiKey", "bp_live_123");
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining(CONFIG_MESSAGES.savedSuccess),
      expect.any(Object)
    );
  });

  it("sets apiBaseUrl value", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runConfig(
      ["set", "apiBaseUrl", "https://betterprompt.me/api"],
      deps,
      factory
    );

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.setValue).toHaveBeenCalledWith(
      "apiBaseUrl",
      "https://betterprompt.me/api"
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining(CONFIG_MESSAGES.savedSuccess),
      expect.any(Object)
    );
  });

  it("outputs JSON for set when --json is provided", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runConfig(
      ["--json", "set", "apiBaseUrl", "https://betterprompt.me/api"],
      deps,
      factory
    );

    expect(deps.setValue).toHaveBeenCalledWith(
      "apiBaseUrl",
      "https://betterprompt.me/api"
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      { success: true, key: "apiBaseUrl" },
      expect.any(Object)
    );
  });

  it("fails and does not save when apiKey validation fails", async () => {
    const deps = createDeps({
      verifyApiKey: mock(async () => {
        throw new Error("API key verification failed. Unauthorized");
      }),
    });
    const factory = createFactoryDeps();

    await runConfig(["set", "apiKey", "bp_bad_key"], deps, factory);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_bad_key");
    expect(deps.setValue).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledTimes(2);
    expect(factory.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/auth.json`
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("shows system config path when setting apiBaseUrl fails", async () => {
    const deps = createDeps({
      setValue: mock(async () => {
        throw new Error("write failed");
      }),
    });
    const factory = createFactoryDeps();

    await runConfig(
      ["set", "apiBaseUrl", "https://betterprompt.me/api"],
      deps,
      factory
    );

    expect(factory.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/config.json`
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
