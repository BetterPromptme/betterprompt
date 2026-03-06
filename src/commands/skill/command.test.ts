import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createProgram } from "../../cli";
import { createSkillCommand } from "./command";
import { createSkillInfoSubcommand } from "./info/command";
import { createSkillInstallSubcommand } from "./install/command";
import { createSkillListSubcommand } from "./list/command";
import { createSkillSearchSubcommand } from "./search/command";
import { createSkillUninstallSubcommand } from "./uninstall/command";
import { createSkillUpdateSubcommand } from "./update/command";

type TSkillDeps = NonNullable<Parameters<typeof createSkillCommand>[0]>;

const createDeps = (overrides: Partial<TSkillDeps> = {}): TSkillDeps => ({
  getSkill: mock(async () => ({ name: "react-hooks" })),
  installSkill: mock(async () => ({ skillName: "react-hooks" })),
  uninstallSkill: mock(async () => ({ skillName: "react-hooks" })),
  listSkills: mock(async () => []),
  updateSkill: mock(async () => ({
    skillName: "react-hooks",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    updated: true,
  })),
  updateAllSkills: mock(async () => []),
  validateQuery: mock((query: string) => query.trim()),
  search: mock(async () => ({ rows: [] })),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const createRoot = (deps: TSkillDeps) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .addCommand(createSkillCommand(deps));

  return root;
};

describe("commands/skill folder tree contract", () => {
  it("exports folderized subcommand entrypoints", () => {
    const deps = createDeps();

    expect(createSkillInfoSubcommand(deps).name()).toBe("info");
    expect(createSkillInstallSubcommand(deps).name()).toBe("install");
    expect(createSkillUninstallSubcommand(deps).name()).toBe("uninstall");
    expect(createSkillListSubcommand(deps).name()).toBe("list");
    expect(createSkillUpdateSubcommand(deps).name()).toBe("update");
    expect(createSkillSearchSubcommand(deps).name()).toBe("search");
  });

  it("registers expected skill subcommands", () => {
    const command = createSkillCommand();
    const subcommandNames = command.commands.map((subcommand) =>
      subcommand.name()
    );

    expect(subcommandNames).toEqual([
      "info",
      "install",
      "uninstall",
      "list",
      "update",
      "search",
    ]);
  });

  it("routes each subcommand action to the expected dependency", async () => {
    const deps = createDeps();
    const root = createRoot(deps);

    await root.parseAsync(["skill", "info", "react-hooks"], { from: "user" });
    await root.parseAsync(["skill", "install", "react-hooks"], {
      from: "user",
    });
    await root.parseAsync(["skill", "uninstall", "react-hooks"], {
      from: "user",
    });
    await root.parseAsync(["skill", "list"], { from: "user" });
    await root.parseAsync(["skill", "update", "react-hooks"], {
      from: "user",
    });
    await root.parseAsync(["skill", "update", "--all"], { from: "user" });
    await root.parseAsync(["skill", "search", "react", "--type", "text"], {
      from: "user",
    });

    expect(deps.getSkill).toHaveBeenCalledWith("react-hooks");
    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.updateAllSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.search).toHaveBeenCalledWith("react", { type: "text" });
  });

  it("keeps top-level search and skill search both registered", () => {
    const program = createProgram();
    const topLevelSearch = program.commands.find(
      (command) => command.name() === "search"
    );
    const skill = program.commands.find((command) => command.name() === "skill");
    const skillSearch = skill?.commands.find(
      (command) => command.name() === "search"
    );

    expect(topLevelSearch).toBeDefined();
    expect(skillSearch).toBeDefined();
  });
});
