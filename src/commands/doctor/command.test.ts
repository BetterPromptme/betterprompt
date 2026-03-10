import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createDoctorCommand } from "./command";
import type { TDoctorCommandDependencies } from "./types";

type TDoctorResult = Awaited<ReturnType<TDoctorCommandDependencies["runDoctorChecks"]>>;

const createResult = (overrides: Partial<TDoctorResult> = {}): TDoctorResult =>
  ({
    healthy: true,
    checks: [
      { name: "auth", status: "pass", message: "Auth key is valid." },
      { name: "registry", status: "pass", message: "Registry is reachable." },
      { name: "dirs", status: "pass", message: "Directories exist." },
      { name: "permissions", status: "pass", message: "Permissions are valid." },
    ],
    ...overrides,
  }) as TDoctorResult;

const createDeps = (
  overrides: Partial<TDoctorCommandDependencies> = {}
): TDoctorCommandDependencies => ({
  runDoctorChecks: mock(async () => createResult()),
  ...overrides,
});

const createFactoryDeps = (
  overrides: Partial<TCommandFactoryDeps> = {}
): Partial<TCommandFactoryDeps> => ({
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (
  deps: TDoctorCommandDependencies,
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
    .addCommand(createDoctorCommand(deps, factoryDeps));

  return root;
};

const runDoctor = async (
  args: string[],
  deps: TDoctorCommandDependencies,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const root = createRoot(deps, factoryDeps);
  await root.parseAsync(["doctor", ...args], { from: "user" });
};

describe("doctor command", () => {
  it("runs doctor checks and prints a human-readable result", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runDoctor([], deps, factory);

    expect(deps.runDoctorChecks).toHaveBeenCalledWith(
      expect.objectContaining({ fix: false })
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("auth"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("passes --fix to the doctor core", async () => {
    const deps = createDeps({
      runDoctorChecks: mock(async () =>
        createResult({
          healthy: false,
          checks: [
            {
              name: "dirs",
              status: "fail",
              message: "Missing ~/.betterprompt/outputs directory.",
              fixed: true,
            },
          ],
        })
      ),
    });
    const factory = createFactoryDeps();

    await runDoctor(["--fix"], deps, factory);

    expect(deps.runDoctorChecks).toHaveBeenCalledWith(
      expect.objectContaining({ fix: true })
    );
    expect(factory.printResult).toHaveBeenCalledWith(
      expect.stringContaining("fixed"),
      expect.objectContaining({ outputFormat: "text" })
    );
  });

  it("prints structured results in --json mode", async () => {
    const result = createResult({
      healthy: false,
      checks: [
        {
          name: "registry",
          status: "fail",
          message: "Registry unreachable: timeout.",
        },
      ],
    });
    const deps = createDeps({
      runDoctorChecks: mock(async () => result),
    });
    const factory = createFactoryDeps();

    await runDoctor(["--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledWith(
      result,
      expect.objectContaining({ outputFormat: "json" })
    );
  });

  it("handles doctor core failures gracefully", async () => {
    const deps = createDeps({
      runDoctorChecks: mock(async () => {
        throw new Error("Registry check failed: ECONNRESET");
      }),
    });
    const factory = createFactoryDeps();

    await runDoctor([], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Doctor command failed: Registry check failed: ECONNRESET")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error doctor core failures gracefully", async () => {
    const deps = createDeps({
      runDoctorChecks: mock(async () => {
        throw "registry timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runDoctor([], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Doctor command failed: registry timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
