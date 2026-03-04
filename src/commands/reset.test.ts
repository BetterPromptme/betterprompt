import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createResetCommand } from "./reset";

type TResetCommandDeps = NonNullable<Parameters<typeof createResetCommand>[0]>;

type TRunResetResult = Awaited<ReturnType<TResetCommandDeps["runReset"]>>;

const createRunResult = (
  overrides: Partial<TRunResetResult> = {}
): TRunResetResult =>
  ({
    removedPath: "~/.betterprompt/",
    confirmed: true,
    ...overrides,
  }) as TRunResetResult;

const createDeps = (
  overrides: Partial<TResetCommandDeps> = {}
): TResetCommandDeps => ({
  confirmReset: mock(async () => true),
  runReset: mock(async () => createRunResult()),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (deps: TResetCommandDeps): Command => {
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
    .addCommand(createResetCommand(deps));

  return root;
};

const runReset = async (args: string[], deps: TResetCommandDeps) => {
  const root = createRoot(deps);
  await root.parseAsync(["reset", ...args], { from: "user" });
};

describe("reset command", () => {
  it("prompts for confirmation by default", async () => {
    const confirmReset = mock(async () => true);
    const deps = createDeps({
      confirmReset,
    });

    await runReset([], deps);

    expect(confirmReset).toHaveBeenCalledTimes(1);
    expect(deps.runReset).toHaveBeenCalledTimes(1);
  });

  it("skips confirmation when --yes is provided", async () => {
    const confirmReset = mock(async () => true);
    const deps = createDeps({
      confirmReset,
    });

    await runReset(["--yes"], deps);

    expect(confirmReset).not.toHaveBeenCalled();
    expect(deps.runReset).toHaveBeenCalledTimes(1);
  });

  it("does not reset when user declines confirmation", async () => {
    const deps = createDeps({
      confirmReset: mock(async () => false),
    });

    await runReset([], deps);

    expect(deps.runReset).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Reset cancelled"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
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

    await runReset(["--yes"], deps);

    expect(deps.runReset).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
      })
    );
    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runReset(["--yes", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runReset(["--yes"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Reset command failed: permission denied")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      runReset: mock(async () => {
        throw "disk busy";
      }),
    });

    await runReset(["--yes"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Reset command failed: disk busy")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
