import { afterEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createResetCommand } from "./command";
import type { TResetCommandDependencies, TRunResetResult } from "./types";

const createRunResult = (
  overrides: Partial<TRunResetResult> = {}
): TRunResetResult =>
  ({
    removedPath: "~/.betterprompt/",
    confirmed: true,
    ...overrides,
  }) as TRunResetResult;

const createDeps = (
  overrides: Partial<TResetCommandDependencies> = {}
): TResetCommandDependencies => ({
  confirmReset: mock(async () => true),
  runReset: mock(async () => createRunResult()),
  ...overrides,
});

const createRoot = (
  deps: TResetCommandDependencies,
  factoryDeps: Partial<TCommandFactoryDeps>
): Command => {
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
    .addCommand(createResetCommand(deps, factoryDeps));

  return root;
};

const runReset = async (
  args: string[],
  deps: TResetCommandDependencies,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const root = createRoot(deps, factoryDeps);
  await root.parseAsync(["reset", ...args], { from: "user" });
};

describe("reset command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("prompts for confirmation by default", async () => {
    const confirmReset = mock(async () => true);
    const deps = createDeps({ confirmReset });
    const factory = createFactoryDeps();

    await runReset([], deps, factory);

    expect(confirmReset).toHaveBeenCalledTimes(1);
    expect(deps.runReset).toHaveBeenCalledTimes(1);
  });

  it("skips confirmation when --yes is provided", async () => {
    const confirmReset = mock(async () => true);
    const deps = createDeps({ confirmReset });
    const factory = createFactoryDeps();

    await runReset(["--yes"], deps, factory);

    expect(confirmReset).not.toHaveBeenCalled();
    expect(deps.runReset).toHaveBeenCalledTimes(1);
  });

  it("does not reset when user declines confirmation", async () => {
    const deps = createDeps({
      confirmReset: mock(async () => false),
    });
    const factory = createFactoryDeps();

    await runReset([], deps, factory);

    expect(deps.runReset).not.toHaveBeenCalled();
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Reset cancelled"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
  });

  it("removes ~/.betterprompt/ directory when reset proceeds", async () => {
    const deps = createDeps({
      runReset: mock(async () =>
        createRunResult({
          removedPath: "~/.betterprompt/",
          confirmed: true,
        })
      ),
    });
    const factory = createFactoryDeps();

    await runReset(["--yes"], deps, factory);

    expect(deps.runReset).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
      })
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Reset complete"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("outputs structured result in --json mode", async () => {
    const deps = createDeps({
      runReset: mock(async () =>
        createRunResult({
          removedPath: "~/.betterprompt/",
          confirmed: true,
        })
      ),
    });
    const factory = createFactoryDeps();

    await runReset(["--yes", "--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      expect.objectContaining({
        removedPath: "~/.betterprompt/",
        confirmed: true,
      }),
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("handles command failures gracefully", async () => {
    const deps = createDeps({
      runReset: mock(async () => {
        throw new Error("permission denied");
      }),
    });
    const factory = createFactoryDeps();

    await runReset(["--yes"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Reset command failed: permission denied")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      runReset: mock(async () => {
        throw "disk busy";
      }),
    });
    const factory = createFactoryDeps();

    await runReset(["--yes"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Reset command failed: disk busy")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});
