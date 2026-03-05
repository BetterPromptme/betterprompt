import { afterEach, describe, expect, it } from "bun:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import type { TCliContext } from "../types/context";
import type { TResolveScope } from "../types/scope";
import { createProgram } from "../cli";
import { resolveContext } from "./context";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-scope-"));
  tempDirs.push(dir);
  return dir;
};

const withCwd = async (nextCwd: string, run: () => Promise<void>): Promise<void> => {
  const previousCwd = process.cwd();
  process.chdir(nextCwd);
  try {
    await run();
  } finally {
    process.chdir(previousCwd);
  }
};

const loadResolveScope = async (): Promise<TResolveScope> => {
  const scopeModulePath = "./scope";
  const scopeModule: unknown = await import(scopeModulePath);

  if (
    typeof scopeModule !== "object" ||
    scopeModule === null ||
    !("resolveScope" in scopeModule)
  ) {
    throw new Error("resolveScope export was not found in src/core/scope.ts");
  }

  const resolveScope = (scopeModule as { resolveScope: unknown }).resolveScope;
  if (typeof resolveScope !== "function") {
    throw new Error("resolveScope must be a function");
  }

  return resolveScope as TResolveScope;
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const parseGlobalFlags = async (argv: string[]): Promise<Record<string, unknown>> => {
  const program = createProgram();
  program.exitOverride();
  const probeCommand = new Command("scope-probe").action(() => {});
  program.addCommand(probeCommand);
  await program.parseAsync(["node", "betterprompt", ...argv, "scope-probe"], {
    from: "node",
  });
  return program.opts<Record<string, unknown>>();
};

const resolveCliContext = async (argv: string[]): Promise<TCliContext> => {
  const flags = await parseGlobalFlags(argv);
  return resolveContext(flags);
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("resolveScope", () => {
  it("resolves --global scope to ~/.betterprompt", async () => {
    const resolveScope = await loadResolveScope();
    const resolved = await Promise.resolve(
      resolveScope(resolveContext({ global: true }))
    );

    expect(resolved).toEqual({
      type: "global",
      rootDir: path.join(homedir(), ".betterprompt"),
    });
  });

  it("resolves --project scope to <cwd>/.betterprompt", async () => {
    const resolveScope = await loadResolveScope();
    const projectDir = await createTempDir();

    await withCwd(projectDir, async () => {
      const resolved = await Promise.resolve(
        resolveScope(resolveContext({ project: true }))
      );

      expect(resolved).toEqual({
        type: "project",
        rootDir: path.join(process.cwd(), ".betterprompt"),
      });
    });
  });

  it("uses --dir path as scope root", async () => {
    const resolveScope = await loadResolveScope();
    const tempDir = await createTempDir();
    const customDir = path.join(tempDir, "custom-root");
    await mkdir(customDir, { recursive: true });

    const resolved = await Promise.resolve(
      resolveScope(resolveContext({ dir: customDir, project: true, global: true }))
    );

    expect(resolved).toEqual({
      type: "dir",
      rootDir: customDir,
    });
  });

  it("uses global scope by default when no scope flag is provided", async () => {
    const resolveScope = await loadResolveScope();
    const ctx = await resolveCliContext([]);

    const resolved = await Promise.resolve(resolveScope(ctx));

    expect(resolved).toEqual({
      type: "global",
      rootDir: path.join(homedir(), ".betterprompt"),
    });
  });

  it("throws when --project and --global are both provided", async () => {
    const flags = await parseGlobalFlags(["--project", "--global"]);

    expect(() => resolveContext(flags)).toThrow(
      "Cannot use --project and --global together"
    );
  });

  it("throws when --dir path does not exist", async () => {
    const resolveScope = await loadResolveScope();
    const tempDir = await createTempDir();
    const missingPath = path.join(tempDir, "does-not-exist");

    await expect(
      Promise.resolve(resolveScope(resolveContext({ dir: missingPath })))
    ).rejects.toThrow();
  });

  it("initializes project-local files and directories when --project is used", async () => {
    const resolveScope = await loadResolveScope();
    const projectDir = await createTempDir();

    await withCwd(projectDir, async () => {
      const resolved = await Promise.resolve(
        resolveScope(resolveContext({ project: true }))
      );

      const projectLocalDir = path.join(process.cwd(), ".betterprompt");
      const projectConfigPath = path.join(projectDir, "betterprompt.json");

      expect(resolved).toEqual({
        type: "project",
        rootDir: projectLocalDir,
      });

      await expect(pathExists(path.join(projectLocalDir, "skills"))).resolves.toBe(true);
      await expect(pathExists(path.join(projectLocalDir, "outputs"))).resolves.toBe(true);
      await expect(pathExists(path.join(projectLocalDir, "cache"))).resolves.toBe(true);
      await expect(pathExists(projectConfigPath)).resolves.toBe(true);

      const configRaw = await readFile(projectConfigPath, "utf8");
      const configParsed = JSON.parse(configRaw);

      expect(typeof configParsed).toBe("object");
      expect(configParsed).not.toBeNull();
      expect(Array.isArray(configParsed)).toBe(false);
      expect("name" in configParsed).toBe(true);
      expect(configParsed.name).toBe(path.basename(projectDir));
    });
  });

  it("keeps project initialization as no-op when betterprompt.json already exists", async () => {
    const resolveScope = await loadResolveScope();
    const projectDir = await createTempDir();
    const projectConfigPath = path.join(projectDir, "betterprompt.json");

    await writeFile(
      projectConfigPath,
      `${JSON.stringify({ name: "custom-project", owner: "team-a" }, null, 2)}\n`
    );
    await withCwd(projectDir, async () => {
      await expect(
        Promise.resolve(resolveScope(resolveContext({ project: true })))
      ).resolves.toEqual({
        type: "project",
        rootDir: path.join(process.cwd(), ".betterprompt"),
      });
    });

    const configRaw = await readFile(projectConfigPath, "utf8");

    expect(JSON.parse(configRaw)).toEqual({
      name: "custom-project",
      owner: "team-a",
    });
  });

  it("uses project-local initialization and does not require global scope paths", async () => {
    const resolveScope = await loadResolveScope();
    const projectDir = await createTempDir();
    const isolatedHome = await createTempDir();
    const previousHome = process.env.HOME;
    process.env.HOME = path.join(isolatedHome, "missing-home");

    try {
      await withCwd(projectDir, async () => {
        const resolved = await Promise.resolve(
          resolveScope(resolveContext({ project: true }))
        );

        expect(resolved).toEqual({
          type: "project",
          rootDir: path.join(process.cwd(), ".betterprompt"),
        });

        await expect(pathExists(path.join(projectDir, ".betterprompt", "skills"))).resolves.toBe(
          true
        );
      });

      await expect(pathExists(path.join(process.env.HOME, ".betterprompt"))).resolves.toBe(
        false
      );
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
