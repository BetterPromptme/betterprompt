import { afterEach, describe, expect, it, mock } from "bun:test";
import { CONFIG_MESSAGES } from "../../../constants";
import { createFactoryDeps } from "../../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
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

describe("config get subcommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("gets apiKey value masked", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });
    const factory = createFactoryDeps();

    await runConfig(["get", "apiKey"], deps, factory);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("*******_123"),
      expect.any(Object)
    );
  });

  it("gets apiBaseUrl value", async () => {
    const deps = createDeps({
      getValue: mock(async () => "https://betterprompt.me/api"),
    });
    const factory = createFactoryDeps();

    await runConfig(["get", "apiBaseUrl"], deps, factory);

    expect(deps.getValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("https://betterprompt.me/api"),
      expect.any(Object)
    );
  });

  it("outputs JSON for get when --json is provided with masked apiKey", async () => {
    const deps = createDeps({
      getValue: mock(async () => "bp_live_123"),
    });
    const factory = createFactoryDeps();

    await runConfig(["--json", "get", "apiKey"], deps, factory);

    expect(deps.getValue).toHaveBeenCalledWith("apiKey");
    expect(factory.printResult).toHaveBeenCalledWith(
      { key: "apiKey", value: "*******_123" },
      expect.any(Object)
    );
  });

  it("lists all config values when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({
        apiKey: "bp_live_123",
        apiBaseUrl: "https://betterprompt.me/api",
      })),
    });
    const factory = createFactoryDeps();

    await runConfig(["get"], deps, factory);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("apiKey=*******_123"),
      expect.any(Object)
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("apiBaseUrl=https://betterprompt.me/api"),
      expect.any(Object)
    );
  });

  it("outputs full config object in JSON mode when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({
        apiKey: "bp_live_123",
        apiBaseUrl: "https://betterprompt.me/api",
      })),
    });
    const factory = createFactoryDeps();

    await runConfig(["--json", "get"], deps, factory);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      { apiKey: "*******_123", apiBaseUrl: "https://betterprompt.me/api" },
      expect.any(Object)
    );
  });

  it("handles empty config gracefully when no key is provided", async () => {
    const deps = createDeps({
      getAllValues: mock(async () => ({})),
    });
    const factory = createFactoryDeps();

    await runConfig(["get"], deps, factory);

    expect(deps.getAllValues).toHaveBeenCalledTimes(1);
    expect(factory.printResult).toHaveBeenCalledWith(
      "No config values set.",
      expect.any(Object)
    );
  });

  it("fails when key value does not exist", async () => {
    const deps = createDeps({
      getValue: mock(async () => undefined),
    });
    const factory = createFactoryDeps();

    await runConfig(["get", "apiKey"], deps, factory);

    expect(factory.error).toHaveBeenCalledTimes(2);
    expect(factory.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/auth.json`
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
