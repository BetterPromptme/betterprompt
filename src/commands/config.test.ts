import { afterEach, describe, expect, it, mock } from "bun:test";
import { CONFIG_MESSAGES } from "../constants";
import { createConfigCommand } from "./config";

type TConfigDeps = NonNullable<Parameters<typeof createConfigCommand>[0]>;

const createDeps = (overrides: Partial<TConfigDeps> = {}): TConfigDeps => ({
  getValue: mock(async () => "value"),
  setValue: mock(async () => "/tmp/.betterprompt/config.json"),
  verifyApiKey: mock(async () => {}),
  resolveConfigPath: mock(() => "/tmp/.betterprompt/config.json"),
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
    expect(deps.log).toHaveBeenCalledWith("bp_live_123");
  });

  it("gets apiBaseUrl value", async () => {
    const deps = createDeps({
      getValue: mock(async () => "https://betterprompt.me/api"),
    });

    await runConfig(["get", "apiBaseUrl"], deps);

    expect(deps.getValue).toHaveBeenCalledWith("apiBaseUrl");
    expect(deps.log).toHaveBeenCalledWith("https://betterprompt.me/api");
  });

  it("sets apiKey value", async () => {
    const deps = createDeps();

    await runConfig(["set", "apiKey", "bp_live_123"], deps);

    expect(deps.verifyApiKey).toHaveBeenCalledWith("bp_live_123");
    expect(deps.setValue).toHaveBeenCalledWith("apiKey", "bp_live_123");
    expect(deps.log).toHaveBeenCalledWith(CONFIG_MESSAGES.savedSuccess);
  });

  it("sets apiBaseUrl value", async () => {
    const deps = createDeps();

    await runConfig(["set", "apiBaseUrl", "https://betterprompt.me/api"], deps);

    expect(deps.verifyApiKey).not.toHaveBeenCalled();
    expect(deps.setValue).toHaveBeenCalledWith(
      "apiBaseUrl",
      "https://betterprompt.me/api"
    );
    expect(deps.log).toHaveBeenCalledWith(CONFIG_MESSAGES.savedSuccess);
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
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("fails when key value does not exist", async () => {
    const deps = createDeps({
      getValue: mock(async () => undefined),
    });

    await runConfig(["get", "apiKey"], deps);

    expect(deps.error).toHaveBeenCalledTimes(2);
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
