import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createProgram } from "./cli";
import * as runCore from "./core/run";

describe("CLI run deprecation contract", () => {
  it("does not register a top-level run command", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).not.toContain("run");
  });

  it("does not mention run command in help text", () => {
    const program = createProgram();
    const help = program.helpInformation();
    const hasRunCommandLine = help
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line.startsWith("run "));

    expect(hasRunCommandLine).toBe(false);
  });

  it("retains core/run.ts createRun and getRun exports", () => {
    expect(typeof runCore.createRun).toBe("function");
    expect(typeof runCore.getRun).toBe("function");
  });

  it("wires generate command through core/run.ts instead of direct /generate posts", () => {
    const generatePath = path.resolve(import.meta.dir, "commands/generate.ts");
    const source = readFileSync(generatePath, "utf8");

    expect(source).toContain('from "../core/run"');
    expect(source).toContain("createRun(");
    expect(source).not.toContain('post("/generate"');
  });

  it("bootstraps global directories at startup instead of direct config init", () => {
    const cliPath = path.resolve(import.meta.dir, "cli.ts");
    const source = readFileSync(cliPath, "utf8");

    expect(source).toContain('from "./core/bootstrap"');
    expect(source).toContain("await bootstrapGlobalDirectory()");
    expect(source).not.toContain("await loadOrInitConfig()");
  });
});
