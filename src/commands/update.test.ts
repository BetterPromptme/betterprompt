import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createUpdateCommand } from "./update";

type TUpdateCommandDeps = NonNullable<Parameters<typeof createUpdateCommand>[0]>;
type TCheckForUpdateResult = Awaited<
  ReturnType<TUpdateCommandDeps["checkForUpdate"]>
>;
type TPerformUpdateResult = Awaited<
  ReturnType<TUpdateCommandDeps["performUpdate"]>
>;

const createCheckResult = (
  overrides: Partial<TCheckForUpdateResult> = {}
): TCheckForUpdateResult =>
  ({
    currentVersion: "0.0.2",
    latestVersion: "0.0.3",
    hasUpdate: true,
    ...overrides,
  }) as TCheckForUpdateResult;

const createUpdateResult = (
  overrides: Partial<TPerformUpdateResult> = {}
): TPerformUpdateResult =>
  ({
    updated: true,
    ...overrides,
  }) as TPerformUpdateResult;

const createDeps = (
  overrides: Partial<TUpdateCommandDeps> = {}
): TUpdateCommandDeps => ({
  checkForUpdate: mock(async () => createCheckResult()),
  performUpdate: mock(async () => createUpdateResult()),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (deps: TUpdateCommandDeps): Command => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .option("--quiet")
    .option("--verbose")
    .option("--no-color")
    .option("--yes")
    .addCommand(createUpdateCommand(deps));

  return root;
};

const runUpdate = async (args: string[], deps: TUpdateCommandDeps) => {
  const root = createRoot(deps);
  await root.parseAsync(["update", ...args], { from: "user" });
};

describe("update command", () => {
  it("triggers update execution when a newer version is available", async () => {
    const checkForUpdate = mock(async () =>
      createCheckResult({
        currentVersion: "0.0.2",
        latestVersion: "0.1.0",
        hasUpdate: true,
      })
    );
    const performUpdate = mock(async () =>
      createUpdateResult({
        updated: true,
      })
    );
    const deps = createDeps({
      checkForUpdate,
      performUpdate,
    });

    await runUpdate([], deps);

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(performUpdate).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVersion: "0.0.2",
        latestVersion: "0.1.0",
        updated: true,
      }),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("shows no-op result when already at latest version", async () => {
    const checkForUpdate = mock(async () =>
      createCheckResult({
        currentVersion: "0.1.0",
        latestVersion: "0.1.0",
        hasUpdate: false,
      })
    );
    const performUpdate = mock(async () =>
      createUpdateResult({
        updated: true,
      })
    );
    const deps = createDeps({
      checkForUpdate,
      performUpdate,
    });

    await runUpdate([], deps);

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(performUpdate).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVersion: "0.1.0",
        latestVersion: "0.1.0",
        updated: false,
      }),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("outputs structured result with versions in --json mode", async () => {
    const deps = createDeps({
      checkForUpdate: mock(async () =>
        createCheckResult({
          currentVersion: "1.0.0",
          latestVersion: "1.1.0",
          hasUpdate: true,
        })
      ),
      performUpdate: mock(async () =>
        createUpdateResult({
          updated: true,
        })
      ),
    });

    await runUpdate(["--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        updated: true,
      }),
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("handles network errors gracefully", async () => {
    const deps = createDeps({
      checkForUpdate: mock(async () => {
        throw new Error("Network unavailable");
      }),
    });

    await runUpdate([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Update command failed: Network unavailable")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      checkForUpdate: mock(async () => {
        throw "connection reset";
      }),
    });

    await runUpdate([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Update command failed: connection reset")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
