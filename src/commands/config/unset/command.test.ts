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

describe("config unset subcommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("unsets existing apiBaseUrl value", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runConfig(["unset", "apiBaseUrl"], deps, factory);

    expect(deps.unsetValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining(CONFIG_MESSAGES.savedSuccess),
      expect.any(Object)
    );
  });

  it("prints clear error when unsetting a missing key", async () => {
    const deps = createDeps({
      unsetValue: mock(async () => {
        throw new Error("apiBaseUrl is not set in config.json.");
      }),
    });
    const factory = createFactoryDeps();

    await runConfig(["unset", "apiBaseUrl"], deps, factory);

    expect(factory.error).toHaveBeenCalledTimes(2);
    expect(factory.error).toHaveBeenLastCalledWith(
      `${CONFIG_MESSAGES.failedNoChangesPrefix} /tmp/.betterprompt/config.json`
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
