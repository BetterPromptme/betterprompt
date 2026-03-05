import { describe, expect, it, mock } from "bun:test";
import { runDoctorChecks } from "./doctor";

type TCheckName =
  | "auth"
  | "registry"
  | "dirs"
  | "permissions";

type TCheckStatus = "pass" | "fail";

type TCheckResult = {
  status: TCheckStatus;
  message: string;
  fix?: () => Promise<void>;
};

type TDoctorDeps = {
  checkAuth: () => Promise<TCheckResult>;
  checkRegistry: () => Promise<TCheckResult>;
  checkDirs: () => Promise<TCheckResult>;
  checkPermissions: () => Promise<TCheckResult>;
};

type TDoctorRunResult = {
  healthy: boolean;
  checks: Array<{
    name: TCheckName;
    status: TCheckStatus;
    message: string;
    fixed?: boolean;
  }>;
};

const pass = (message: string): TCheckResult => ({
  status: "pass",
  message,
});

const fail = (message: string, fix?: () => Promise<void>): TCheckResult => ({
  status: "fail",
  message,
  ...(fix !== undefined && { fix }),
});

const createDeps = (overrides: Partial<TDoctorDeps> = {}): TDoctorDeps => ({
  checkAuth: mock(async () => pass("Auth key is valid.")),
  checkRegistry: mock(async () => pass("Registry is reachable.")),
  checkDirs: mock(async () => pass("All required directories exist.")),
  checkPermissions: mock(async () => pass("Write permissions are valid.")),
  ...overrides,
});

const runDoctor = async (
  deps: TDoctorDeps,
  fixMode = false
): Promise<TDoctorRunResult> =>
  (runDoctorChecks as unknown as (options: {
    fix?: boolean;
    deps: TDoctorDeps;
  }) => Promise<TDoctorRunResult>)({
    fix: fixMode,
    deps,
  });

describe("doctor core", () => {
  it("reports all checks as pass on a healthy system", async () => {
    const deps = createDeps();

    const result = await runDoctor(deps);

    expect(result.healthy).toBe(true);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.map((check) => check.name)).toEqual([
      "auth",
      "registry",
      "dirs",
      "permissions",
    ]);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("marks health as failed when each check fails individually", async () => {
    const failingChecks: Array<{
      name: TCheckName;
      override: Partial<TDoctorDeps>;
      expectedMessage: string;
    }> = [
      {
        name: "auth",
        override: {
          checkAuth: mock(async () => fail("No API key configured.")),
        },
        expectedMessage: "No API key configured.",
      },
      {
        name: "registry",
        override: {
          checkRegistry: mock(async () => fail("Registry unreachable: timeout.")),
        },
        expectedMessage: "Registry unreachable: timeout.",
      },
      {
        name: "dirs",
        override: {
          checkDirs: mock(async () => fail("Missing skills directory: ~/.betterprompt/skills.")),
        },
        expectedMessage: "Missing skills directory: ~/.betterprompt/skills.",
      },
      {
        name: "permissions",
        override: {
          checkPermissions: mock(async () => fail("No write permission to skills directory: ~/.betterprompt/skills.")),
        },
        expectedMessage: "No write permission to skills directory: ~/.betterprompt/skills.",
      },
    ];

    for (const failingCheck of failingChecks) {
      const deps = createDeps(failingCheck.override);

      const result = await runDoctor(deps);

      expect(result.healthy).toBe(false);
      const check = result.checks.find((entry) => entry.name === failingCheck.name);
      expect(check).toBeDefined();
      expect(check?.status).toBe("fail");
      expect(check?.message).toContain(failingCheck.expectedMessage);
    }
  });

  it("auth check detects missing and invalid key states", async () => {
    const missingKeyDeps = createDeps({
      checkAuth: mock(async () => fail("No API key configured.")),
    });

    const missingKeyResult = await runDoctor(missingKeyDeps);
    expect(
      missingKeyResult.checks.find((check) => check.name === "auth")
    ).toMatchObject({
      status: "fail",
      message: "No API key configured.",
    });

    const invalidKeyDeps = createDeps({
      checkAuth: mock(async () => fail("API key is invalid or expired.")),
    });

    const invalidKeyResult = await runDoctor(invalidKeyDeps);
    expect(invalidKeyResult.checks.find((check) => check.name === "auth")).toMatchObject({
      status: "fail",
      message: "API key is invalid or expired.",
    });
  });

  it("registry check reports unreachable endpoint failures", async () => {
    const deps = createDeps({
      checkRegistry: mock(async () => fail("Registry unreachable: ECONNREFUSED.")),
    });

    const result = await runDoctor(deps);

    expect(result.healthy).toBe(false);
    expect(result.checks.find((check) => check.name === "registry")).toMatchObject({
      status: "fail",
      message: "Registry unreachable: ECONNREFUSED.",
    });
  });

  it("--fix remediates missing directories", async () => {
    const fixDirs = mock(async () => {});
    const deps = createDeps({
      checkDirs: mock(async () =>
        fail("Missing skills directory: ~/.betterprompt/skills.", fixDirs)
      ),
    });

    const result = await runDoctor(deps, true);

    expect(fixDirs).toHaveBeenCalledTimes(1);
    expect(result.checks.find((check) => check.name === "dirs")).toMatchObject({
      status: "fail",
      fixed: true,
    });
  });

  it("--fix remediates file permission issues", async () => {
    const fixPermissions = mock(async () => {});
    const deps = createDeps({
      checkPermissions: mock(async () =>
        fail("No write permission to skills directory: ~/.betterprompt/skills.", fixPermissions)
      ),
    });

    const result = await runDoctor(deps, true);

    expect(fixPermissions).toHaveBeenCalledTimes(1);
    expect(
      result.checks.find((check) => check.name === "permissions")
    ).toMatchObject({
      status: "fail",
      fixed: true,
    });
  });

  it("--fix does not mark failed checks as fixed when no remediation callback exists", async () => {
    const deps = createDeps({
      checkRegistry: mock(async () => fail("Registry unreachable: timeout.")),
    });

    const result = await runDoctor(deps, true);

    const registryCheck = result.checks.find((check) => check.name === "registry");
    expect(registryCheck).toMatchObject({
      status: "fail",
      message: "Registry unreachable: timeout.",
    });
    expect(registryCheck?.fixed).toBeUndefined();
  });
});
