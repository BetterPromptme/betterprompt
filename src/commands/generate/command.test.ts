import { describe, expect, it, mock } from "bun:test";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { createGenerateCommand } from "./command";
import { RunStatus } from "../../enums";

const createDeps = (overrides = {}) =>
  ({
    generate: mock(async () => ({
      runId: "run-123",
      outputs: [],
      runStatus: RunStatus.Queued,
    })),
    readStdin: mock(async () => "{}"),
    resolveScope: mock(async () => ({
      type: "project" as const,
      rootDir: "/tmp/.betterprompt",
    })),
    persistRunOutput: mock(async () => ({
      outputDir: "/tmp/.betterprompt/outputs/2026/03/run-123",
      historyFilePath: "/tmp/.betterprompt/outputs/history.jsonl",
    })),
    isStdinTTY: mock(() => false),
    printResult: mock(() => {}),
    error: mock(() => {}),
    setExitCode: mock(() => {}),
    ...overrides,
  }) satisfies NonNullable<Parameters<typeof createGenerateCommand>[0]>;

const createRoot = (deps: ReturnType<typeof createDeps>) => {
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
    .addCommand(createGenerateCommand(deps));
  return root;
};

describe("commands/generate/command", () => {
  it("preserves generate command behavior from folder path", async () => {
    const deps = createDeps();
    const root = createRoot(deps);

    await root.parseAsync(
      ["generate", "skill-version-123", "--input", "topic=ai"],
      {
        from: "user",
      }
    );

    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledTimes(1);
  });

  it("keeps parser/service/presenter boundaries in command wiring", () => {
    const commandPath = path.resolve(import.meta.dir, "command.ts");
    const source = readFileSync(commandPath, "utf8");

    expect(source).toContain('from "../../services/generate/service"');
    expect(source).toContain("executeGenerate");
    expect(source).toContain("createDefaultGenerateDependencies");
    expect(source).not.toContain('from "../core' + '/run"');
  });

  it("requires folder-local types and service modules for generate", () => {
    const typesPath = path.resolve(import.meta.dir, "types.d.ts");
    const servicePath = path.resolve(
      import.meta.dir,
      "../../services/generate/service.ts"
    );
    const parsersPath = path.resolve(
      import.meta.dir,
      "../../services/generate/parsers.ts"
    );
    const presentersPath = path.resolve(
      import.meta.dir,
      "../../services/generate/presenters.ts"
    );

    expect(existsSync(typesPath)).toBe(true);
    expect(existsSync(servicePath)).toBe(true);
    expect(existsSync(parsersPath)).toBe(true);
    expect(existsSync(presentersPath)).toBe(true);
  });
});
