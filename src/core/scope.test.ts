import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { createProgram } from "../cli";
import { resolveContext } from "./context";

type TResolvedScope = {
  type: "global" | "project" | "dir";
  rootDir: string;
};

type TResolveScope = (
  ctx: ReturnType<typeof resolveContext>
) => TResolvedScope | Promise<TResolvedScope>;

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-scope-"));
  tempDirs.push(dir);
  return dir;
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
    const resolved = await Promise.resolve(
      resolveScope(resolveContext({ project: true }))
    );

    expect(resolved).toEqual({
      type: "project",
      rootDir: path.join(process.cwd(), ".betterprompt"),
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
    const flags = await parseGlobalFlags([]);
    const ctx = resolveContext(flags);

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
});
