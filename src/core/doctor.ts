import { access, chmod, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { API_CONFIG } from "../constants";
import { readApiKeyFromAuthConfig, verifyApiKey } from "./auth";
import { loadOrInitConfig } from "./config";
import type {
  TDoctorCheck,
  TDoctorCheckName,
  TDoctorCheckResult,
  TDoctorCoreDependencies,
  TDoctorResult,
  TRunDoctorChecksOptions,
} from "../types/doctor";

const BETTERPROMPT_DIR_MODE = 0o700;

const getRootDir = (): string => path.join(os.homedir(), ".betterprompt");

const getSkillsDir = (): string => path.join(getRootDir(), "skills");

const getRequiredDirs = (): string[] => {
  const rootDir = getRootDir();
  const skillsDir = getSkillsDir();
  return [
    rootDir,
    skillsDir,
    path.join(rootDir, "outputs"),
    path.join(rootDir, "logs"),
    path.join(rootDir, "tmp"),
  ];
};

const pass = (message: string): TDoctorCheck => ({
  status: "pass",
  message,
});

const fail = (message: string, fix?: () => Promise<void>): TDoctorCheck => ({
  status: "fail",
  message,
  ...(fix !== undefined && { fix }),
});

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const checkAuth = async (): Promise<TDoctorCheck> => {
  try {
    const apiKey = await readApiKeyFromAuthConfig();
    await verifyApiKey(apiKey);
    return pass("Auth key is valid.");
  } catch (error) {
    return fail(`Auth check failed: ${toErrorMessage(error)}`);
  }
};

const checkRegistry = async (): Promise<TDoctorCheck> => {
  try {
    const config = await loadOrInitConfig();
    const baseUrl = config.apiBaseUrl ?? API_CONFIG.baseUrl;
    const response = await fetch(baseUrl + "/", { method: "GET" });

    if (response.status >= 500) {
      return fail(`Registry unreachable: HTTP ${response.status}.`);
    }

    return pass("Registry is reachable.");
  } catch (error) {
    return fail(`Registry unreachable: ${toErrorMessage(error)}`);
  }
};

const checkDirs = async (): Promise<TDoctorCheck> => {
  const skillsDir = getSkillsDir();
  try {
    await access(skillsDir, constants.F_OK);
  } catch {
    return fail(`Missing skills directory: ${skillsDir}.`, async () => {
      await mkdir(skillsDir, {
        recursive: true,
        mode: BETTERPROMPT_DIR_MODE,
      });
    });
  }

  const requiredDirs = getRequiredDirs();
  const missingDirs: string[] = [];

  for (const dirPath of requiredDirs) {
    try {
      await access(dirPath, constants.F_OK);
    } catch {
      missingDirs.push(dirPath);
    }
  }

  if (missingDirs.length === 0) {
    return pass("All required directories exist.");
  }

  return fail(`Missing directories: ${missingDirs.join(", ")}`, async () => {
    await Promise.all(
      missingDirs.map((dirPath) =>
        mkdir(dirPath, { recursive: true, mode: BETTERPROMPT_DIR_MODE })
      )
    );
  });
};

const checkPermissions = async (): Promise<TDoctorCheck> => {
  const skillsDir = getSkillsDir();
  try {
    await access(skillsDir, constants.W_OK);
  } catch {
    return fail(
      `No write permission to skills directory: ${skillsDir}.`,
      async () => {
        const stats = await stat(skillsDir).catch(() => undefined);
        if (stats?.isDirectory()) {
          await chmod(skillsDir, BETTERPROMPT_DIR_MODE).catch(() => {});
        }
      }
    );
  }

  const requiredDirs = getRequiredDirs();
  const deniedDirs: string[] = [];

  for (const dirPath of requiredDirs) {
    try {
      await access(dirPath, constants.W_OK);
    } catch {
      deniedDirs.push(dirPath);
    }
  }

  if (deniedDirs.length === 0) {
    return pass("Write permissions are valid.");
  }

  return fail(`No write permission to: ${deniedDirs.join(", ")}`, async () => {
    await Promise.all(
      deniedDirs.map(async (dirPath) => {
        const stats = await stat(dirPath).catch(() => undefined);
        if (stats?.isDirectory()) {
          await chmod(dirPath, BETTERPROMPT_DIR_MODE).catch(() => {});
        }
      })
    );
  });
};

const defaultDeps: TDoctorCoreDependencies = {
  checkAuth,
  checkRegistry,
  checkDirs,
  checkPermissions,
};

const CHECK_ORDER: Array<{
  name: TDoctorCheckName;
  run: (deps: TDoctorCoreDependencies) => Promise<TDoctorCheck>;
}> = [
  { name: "auth", run: (deps) => deps.checkAuth() },
  { name: "registry", run: (deps) => deps.checkRegistry() },
  { name: "dirs", run: (deps) => deps.checkDirs() },
  { name: "permissions", run: (deps) => deps.checkPermissions() },
];

export const runDoctorChecks = async (
  options: TRunDoctorChecksOptions = {}
): Promise<TDoctorResult> => {
  const deps = options.deps ?? defaultDeps;
  const fixMode = options.fix === true;
  const checks: TDoctorCheckResult[] = [];

  for (const checkEntry of CHECK_ORDER) {
    let check: TDoctorCheck;
    try {
      check = await checkEntry.run(deps);
    } catch (error) {
      check = fail(toErrorMessage(error));
    }

    const result: TDoctorCheckResult = {
      name: checkEntry.name,
      status: check.status,
      message: check.message,
    };

    if (fixMode && check.status === "fail" && check.fix !== undefined) {
      await check.fix();
      result.fixed = true;
    }

    checks.push(result);
  }

  return {
    healthy: checks.every((check) => check.status === "pass"),
    checks,
  };
};
