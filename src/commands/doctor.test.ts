import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createDoctorCommand } from "./doctor";

type TDoctorCommandDeps = NonNullable<Parameters<typeof createDoctorCommand>[0]>;
type TDoctorResult = Awaited<ReturnType<TDoctorCommandDeps["runDoctorChecks"]>>;

const createResult = (overrides: Partial<TDoctorResult> = {}): TDoctorResult =>
  ({
    healthy: true,
    checks: [
      { name: "auth", status: "pass", message: "Auth key is valid." },
      { name: "registry", status: "pass", message: "Registry is reachable." },
      { name: "dirs", status: "pass", message: "Directories exist." },
      { name: "lockfile", status: "pass", message: "Lockfile is synced." },
      { name: "wrappers", status: "pass", message: "Wrappers are present." },
      { name: "permissions", status: "pass", message: "Permissions are valid." },
    ],
    ...overrides,
  }) as TDoctorResult;

const createDeps = (
  overrides: Partial<TDoctorCommandDeps> = {}
): TDoctorCommandDeps => ({
  runDoctorChecks: mock(async () => createResult()),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (deps: TDoctorCommandDeps): Command => {
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
    .addCommand(createDoctorCommand(deps));

  return root;
};

const runDoctor = async (args: string[], deps: TDoctorCommandDeps) => {
  const root = createRoot(deps);
  await root.parseAsync(["doctor", ...args], { from: "user" });
};

describe("doctor command", () => {
  it("runs doctor checks and prints a human-readable result", async () => {
    const deps = createDeps();

    await runDoctor([], deps);

    expect(deps.runDoctorChecks).toHaveBeenCalledWith(
      expect.objectContaining({ fix: false })
    );
    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runDoctor(["--fix"], deps);

    expect(deps.runDoctorChecks).toHaveBeenCalledWith(
      expect.objectContaining({ fix: true })
    );
    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runDoctor(["--json"], deps);

    expect(deps.printResult).toHaveBeenCalledWith(
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

    await runDoctor([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Doctor command failed: Registry check failed: ECONNRESET")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error doctor core failures gracefully", async () => {
    const deps = createDeps({
      runDoctorChecks: mock(async () => {
        throw "registry timeout";
      }),
    });

    await runDoctor([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Doctor command failed: registry timeout")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
