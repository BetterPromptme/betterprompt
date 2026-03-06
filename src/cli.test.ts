import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import packageJson from "../package.json";
import { createProgram } from "./cli";
import * as runService from "./services/run/service";

const expectedTopLevelCommands = [
  "config",
  "auth",
  "whoami",
  "credits",
  "doctor",
  "generate",
  "outputs",
  "search",
  "skill",
  "update",
  "reset",
];

describe("CLI run deprecation contract", () => {
  it("keeps binary aliases mapped to the same CLI entrypoint", () => {
    expect(packageJson.bin).toEqual({
      betterprompt: "bin/betterprompt.js",
      bp: "bin/betterprompt.js",
    });
  });

  it("registers the expected top-level commands in a stable order", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(expectedTopLevelCommands);
  });

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

  it("retains services/run/service.ts createRun and getRun exports", () => {
    expect(typeof runService.createRun).toBe("function");
    expect(typeof runService.getRun).toBe("function");
  });

  it("removes flat generate command adapter", () => {
    const generatePath = path.resolve(import.meta.dir, "commands/generate.ts");
    expect(existsSync(generatePath)).toBe(false);
  });

  it("registers generate from folder entrypoint instead of flat command implementation", () => {
    const cliPath = path.resolve(import.meta.dir, "cli.ts");
    const source = readFileSync(cliPath, "utf8");

    expect(source).toContain('from "./commands/generate/command"');
    expect(source).not.toContain('from "./commands/generate"');
  });

  it("bootstraps global directories at startup instead of direct config init", () => {
    const cliPath = path.resolve(import.meta.dir, "cli.ts");
    const source = readFileSync(cliPath, "utf8");

    expect(source).toContain('from "./services/bootstrap/service"');
    expect(source).toContain("await bootstrapGlobalDirectory()");
    expect(source).not.toContain("await loadOrInitConfig()");
  });

  it("imports help formatter from cli/help instead of core/help", () => {
    const cliPath = path.resolve(import.meta.dir, "cli.ts");
    const source = readFileSync(cliPath, "utf8");

    expect(source).toContain('from "./cli/help"');
    expect(source).not.toContain('from "./core' + '/help"');
  });

  it("removes legacy core help module after migration", () => {
    const coreHelpPath = path.resolve(import.meta.dir, "core/help.ts");
    expect(existsSync(coreHelpPath)).toBe(false);
  });
});

describe("CLI command registration parity", () => {
  it("keeps top-level search and nested skill search commands aligned", () => {
    const program = createProgram();
    const searchCommand = program.commands.find((command) => command.name() === "search");
    const skillCommand = program.commands.find((command) => command.name() === "skill");
    const skillSearchCommand = skillCommand?.commands.find(
      (command) => command.name() === "search"
    );

    expect(searchCommand).toBeDefined();
    expect(skillCommand).toBeDefined();
    expect(skillSearchCommand).toBeDefined();
    expect(searchCommand?.description()).toBe(skillSearchCommand?.description());
    expect(searchCommand?.options.map((option) => option.long)).toEqual(
      skillSearchCommand?.options.map((option) => option.long)
    );
  });
});

describe("CLI help output parity", () => {
  it("keeps stable top-level help command visibility", () => {
    const program = createProgram();
    const help = program.helpInformation();

    for (const commandName of expectedTopLevelCommands) {
      expect(help).toContain(commandName);
    }
  });

  it("keeps expected skill subcommands in help output", () => {
    const program = createProgram();
    const skillCommand = program.commands.find((command) => command.name() === "skill");
    const skillHelp = skillCommand?.helpInformation() ?? "";

    expect(skillHelp).toContain("info");
    expect(skillHelp).toContain("install");
    expect(skillHelp).toContain("uninstall");
    expect(skillHelp).toContain("list");
    expect(skillHelp).toContain("update");
    expect(skillHelp).toContain("search");
  });

  it("keeps expected config and outputs nested help output", () => {
    const program = createProgram();
    const configCommand = program.commands.find((command) => command.name() === "config");
    const outputsCommand = program.commands.find((command) => command.name() === "outputs");
    const configHelp = configCommand?.helpInformation() ?? "";
    const outputsHelp = outputsCommand?.helpInformation() ?? "";

    expect(configHelp).toContain("get");
    expect(configHelp).toContain("set");
    expect(configHelp).toContain("unset");
    expect(outputsHelp).toContain("<run-id>");
    expect(outputsHelp).toContain("--sync");
    expect(outputsHelp).toContain("--remote");
    expect(outputsHelp).toContain("list");
  });
});
