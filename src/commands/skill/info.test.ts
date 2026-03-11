import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createProgram } from "../../cli";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createSkillCommand } from "./command";
import { createSkillInfoSubcommand } from "./info/command";

type TSkillsDeps = NonNullable<Parameters<typeof createSkillCommand>[0]>;

const createDeps = (overrides: Partial<TSkillsDeps> = {}): TSkillsDeps => ({
  getSkill: mock(async () => ({
    skillId: "abc123",
    title: "React Hooks",
    description: "A guide to React hooks",
    name: "react-hooks",
    skillmd: "# React Hooks",
  })),
  installSkill: mock(async () => ({
    skillName: "react-hooks",
    installPath: "/tmp/.betterprompt/skills/react-hooks",
  })),
  uninstallSkill: mock(async () => ({
    skillName: "react-hooks",
    removedPath: "/tmp/.betterprompt/skills/react-hooks",
  })),
  listSkills: mock(async () => []),
  updateSkill: mock(async () => ({
    skillName: "react-hooks",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    updated: true,
  })),
  updateAllSkills: mock(async () => []),
  validateQuery: mock((query: string) => query.trim()),
  search: mock(async () => ({
    rows: [],
  })),
  ...overrides,
});

const runInfo = async (
  args: string[],
  deps: TSkillsDeps,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const command = createSkillInfoSubcommand(deps, factoryDeps);
  const root = new Command("betterprompt");
  root.option("--json");
  root.addCommand(command);
  await root.parseAsync(["info", ...args], { from: "user" });
};

describe("skills command", () => {
  it("registers the command as singular 'skill'", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain("skill");
    expect(commandNames).not.toContain("skills");
  });

  it("resolves skill by name and prints human-readable output by default", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInfo(["react-hooks"], deps, factory);

    expect(deps.getSkill).toHaveBeenCalledWith("react-hooks");
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      skillId: "abc123",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      skillmd: "# React Hooks",
    });
    expect(ctx.outputFormat).toBe("text");
  });

  it("supports --json output for skill info", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInfo(["react-hooks", "--json"], deps, factory);

    expect(deps.getSkill).toHaveBeenCalledWith("react-hooks");
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({
      skillId: "abc123",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      skillmd: "# React Hooks",
    });
    expect(ctx.outputFormat).toBe("json");
  });

  it("calls getSkill with only the skill name (no extra options)", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInfo(["react-hooks"], deps, factory);

    expect(deps.getSkill).toHaveBeenCalledTimes(1);
    expect(deps.getSkill).toHaveBeenCalledWith("react-hooks");
  });

  it("exposes info as a subcommand under skill", () => {
    const command = createSkillCommand();
    const infoCommand = command.commands.find((subcommand) => subcommand.name() === "info");

    expect(command.name()).toBe("skill");
    expect(infoCommand).toBeDefined();
  });

  it("help text references singular skill command", () => {
    const command = createProgram().commands.find(
      (registeredCommand) => registeredCommand.name() === "skill"
    );

    if (!command) {
      throw new Error("Expected skill command to be registered");
    }

    const help = command.helpInformation();

    expect(help).toContain("skill");
    expect(help).toContain("Usage: betterprompt skill");
    expect(help).not.toContain("Usage: skills");
    expect(help).not.toContain("skills info");
  });

  it("logs skill not found error and sets exit code", async () => {
    const deps = createDeps({
      getSkill: mock(async () => {
        throw new Error("Skill not found");
      }),
    });
    const factory = createFactoryDeps();

    await runInfo(["unknown-skill"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Skill not found")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("logs error and sets exit code when skill name is empty string", async () => {
    const deps = createDeps({
      getSkill: mock(async () => {
        throw new Error("Skill name must not be empty.");
      }),
    });
    const factory = createFactoryDeps();

    await runInfo([""], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Skill name must not be empty.")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables from info handler", async () => {
    const deps = createDeps({
      getSkill: mock(async () => {
        throw "service unavailable";
      }),
    });
    const factory = createFactoryDeps();

    await runInfo(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: service unavailable")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});
