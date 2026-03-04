import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createUninstallCommand } from "./uninstall";

type TUninstallCommandDeps = NonNullable<
  Parameters<typeof createUninstallCommand>[0]
>;

type TRunUninstallResult = Awaited<
  ReturnType<TUninstallCommandDeps["runUninstall"]>
>;

const createRunResult = (
  overrides: Partial<TRunUninstallResult> = {}
): TRunUninstallResult =>
  ({
    removedPath: "~/.betterprompt/",
    removedPackage: false,
    confirmed: true,
    ...overrides,
  }) as TRunUninstallResult;

const createDeps = (
  overrides: Partial<TUninstallCommandDeps> = {}
): TUninstallCommandDeps => ({
  confirmUninstall: mock(async () => true),
  runUninstall: mock(async () => createRunResult()),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (deps: TUninstallCommandDeps): Command => {
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
    .addCommand(createUninstallCommand(deps));

  return root;
};

const runUninstall = async (args: string[], deps: TUninstallCommandDeps) => {
  const root = createRoot(deps);
  await root.parseAsync(["uninstall", ...args], { from: "user" });
};

describe("uninstall command", () => {
  it("prompts for confirmation by default", async () => {
    const confirmUninstall = mock(async () => true);
    const deps = createDeps({
      confirmUninstall,
    });

    await runUninstall([], deps);

    expect(confirmUninstall).toHaveBeenCalledTimes(1);
    expect(deps.runUninstall).toHaveBeenCalledTimes(1);
  });

  it("skips confirmation when --yes is provided", async () => {
    const confirmUninstall = mock(async () => true);
    const deps = createDeps({
      confirmUninstall,
    });

    await runUninstall(["--yes"], deps);

    expect(confirmUninstall).not.toHaveBeenCalled();
    expect(deps.runUninstall).toHaveBeenCalledTimes(1);
  });

  it("does not cleanup when user declines confirmation", async () => {
    const deps = createDeps({
      confirmUninstall: mock(async () => false),
    });

    await runUninstall([], deps);

    expect(deps.runUninstall).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.stringContaining("Uninstall cancelled"),
      expect.objectContaining({ outputFormat: "text" })
    );
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("removes ~/.betterprompt/ directory when uninstall proceeds", async () => {
    const deps = createDeps({
      runUninstall: mock(async () =>
        createRunResult({
          removedPath: "~/.betterprompt/",
          confirmed: true,
        })
      ),
    });

    await runUninstall(["--yes"], deps);

    expect(deps.runUninstall).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
      })
    );
    expect(deps.printResult).toHaveBeenCalledWith(
      expect.objectContaining({ removedPath: "~/.betterprompt/" }),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("outputs structured result in --json mode", async () => {
    const deps = createDeps({
      runUninstall: mock(async () =>
        createRunResult({
          removedPath: "~/.betterprompt/",
          removedPackage: true,
          confirmed: true,
        })
      ),
    });

    await runUninstall(["--yes", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
      expect.objectContaining({
        removedPath: "~/.betterprompt/",
        removedPackage: true,
        confirmed: true,
      }),
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("handles command failures gracefully", async () => {
    const deps = createDeps({
      runUninstall: mock(async () => {
        throw new Error("permission denied");
      }),
    });

    await runUninstall(["--yes"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Uninstall command failed: permission denied")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error failures gracefully", async () => {
    const deps = createDeps({
      runUninstall: mock(async () => {
        throw "disk busy";
      }),
    });

    await runUninstall(["--yes"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Uninstall command failed: disk busy")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
