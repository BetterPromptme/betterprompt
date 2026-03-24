import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createSkillCommand } from "./command";
import { createSkillInstallSubcommand } from "./install/command";
import { createSkillListSubcommand } from "./list/command";
import { createSkillSearchSubcommand } from "./search/command";
import { createSkillUninstallSubcommand } from "./uninstall/command";
import { createSkillUpdateSubcommand } from "./update/command";

type TSkillInstallOptions = {
  scope: {
    type: "global" | "project" | "dir";
    path?: string;
  };
  overwrite?: boolean;
};

type TSkillListOptions = {
  scope: TSkillInstallOptions["scope"];
};

type TSkillSummary = {
  name: string;
  title?: string;
  skillmdUrl?: string;
};

type TSkillUpdateResult = {
  skillName: string;
  updated: boolean;
  from?: string;
  to?: string;
};

type TSkillUpdateOptions = {
  scope: TSkillInstallOptions["scope"];
  force?: boolean;
};

type TSkillUpdateAllOptions = {
  scope: TSkillInstallOptions["scope"];
  force?: boolean;
};

type TSkillCommandDeps = NonNullable<
  Parameters<typeof createSkillCommand>[0]
> & {
  installSkill: (
    skillName: string,
    options: TSkillInstallOptions
  ) => Promise<unknown>;
  uninstallSkill: (
    skillName: string,
    options: { scope: TSkillInstallOptions["scope"] }
  ) => Promise<unknown>;
  listSkills: (options: TSkillListOptions) => Promise<TSkillSummary[]>;
  updateSkill: (
    skillName: string,
    options: TSkillUpdateOptions
  ) => Promise<TSkillUpdateResult>;
  updateAllSkills: (
    options: TSkillUpdateAllOptions
  ) => Promise<TSkillUpdateResult[]>;
};

const createDeps = (
  overrides: Partial<TSkillCommandDeps> = {}
): TSkillCommandDeps => ({
  getSkill: mock(async () => ({
    skillId: "abc123",
    title: "React Hooks",
    description: "A guide to React hooks",
    name: "react-hooks",
    skillmdUrl:
      "https://raw.githubusercontent.com/org/repo/abc123/skills/react-hooks/SKILL.md",
  })),
  validateQuery: mock((query: string) => query.trim()),
  search: mock(async () => ({
    rows: [],
  })),
  installSkill: mock(async () => ({
    skillName: "react-hooks",
    installPath: "/tmp/project/.betterprompt/skills/react-hooks",
  })),
  uninstallSkill: mock(async () => ({
    skillName: "react-hooks",
    removedPath: "/tmp/project/.betterprompt/skills/react-hooks",
  })),
  listSkills: mock(async () => []),
  updateSkill: mock(async () => ({
    skillName: "react-hooks",
    updated: true,
    from: "c776916",
    to: "a1b2c3d",
  })),
  updateAllSkills: mock(async () => [
    {
      skillName: "react-hooks",
      updated: true,
      from: "c776916",
      to: "a1b2c3d",
    },
  ]),
  ...overrides,
});

const runInstall = async (
  args: string[],
  deps: TSkillCommandDeps,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json");
  const command = createSkillInstallSubcommand(deps, factoryDeps);
  root.addCommand(command);
  await root.parseAsync(["install", ...args], { from: "user" });
};

const runUninstall = async (
  args: string[],
  deps: TSkillCommandDeps,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json");
  const command = createSkillUninstallSubcommand(deps, factoryDeps);
  root.addCommand(command);
  await root.parseAsync(["uninstall", ...args], { from: "user" });
};

const runList = async (
  args: string[],
  deps: TSkillCommandDeps,
  factoryDeps: Partial<TCommandFactoryDeps> = {}
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json");
  const command = createSkillListSubcommand(deps, factoryDeps);
  root.addCommand(command);
  await root.parseAsync(["list", ...args], { from: "user" });
};

const runUpdate = async (
  args: string[],
  deps: TSkillCommandDeps,
  factoryDeps: Partial<TCommandFactoryDeps> = {}
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json");
  const command = createSkillUpdateSubcommand(deps, factoryDeps);
  root.addCommand(command);
  await root.parseAsync(["update", ...args], { from: "user" });
};

const runSearch = async (
  args: string[],
  deps: TSkillCommandDeps,
  factoryDeps: Partial<TCommandFactoryDeps> = {}
) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json");
  const command = createSkillSearchSubcommand(deps, factoryDeps);
  root.addCommand(command);
  await root.parseAsync(["search", ...args], { from: "user" });
};

describe("skill install command", () => {
  it("does not register deprecated --version option", () => {
    const command = createSkillCommand();
    const installCommand = command.commands.find(
      (subcommand) => subcommand.name() === "install"
    );

    expect(installCommand).toBeDefined();
    expect(
      installCommand?.options.some((option) => option.long === "--version")
    ).toBe(false);
  });

  it("installs a skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [installData, installCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(installData).toEqual({
      skillName: "react-hooks",
      installPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(installCtx.outputFormat).toBe("text");
  });

  it("does not forward optional flags when they are not provided", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks"], deps, factory);

    const [, options] = (deps.installSkill as ReturnType<typeof mock>).mock
      .calls[0] as [string, TSkillInstallOptions];
    expect(options.overwrite).toBeUndefined();
  });

  it("supports --json output for install results", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks", "--json"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [installJsonData, installJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(installJsonData).toEqual({
      skillName: "react-hooks",
      installPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(installJsonCtx.outputFormat).toBe("json");
  });

  it("forwards project scope when --project is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks", "--project"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });
  });

  it("forwards global scope when --global is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks", "--global"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks", "--dir", "/work/demo"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("forwards --overwrite flag", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runInstall(["react-hooks", "--overwrite"], deps, factory);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
      overwrite: true,
    });
  });

  it("handles invalid skill name errors gracefully", async () => {
    const deps = createDeps({
      installSkill: mock(async () => {
        throw new Error("Skill name must not be empty.");
      }),
    });
    const factory = createFactoryDeps();

    await runInstall(["   "], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Skill command failed: Skill name must not be empty."
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully", async () => {
    const deps = createDeps({
      installSkill: mock(async () => {
        throw new Error("Registry unavailable");
      }),
    });
    const factory = createFactoryDeps();

    await runInstall(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Registry unavailable")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully", async () => {
    const deps = createDeps({
      installSkill: mock(async () => {
        throw "timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runInstall(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("skill uninstall command", () => {
  it("uninstalls a skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUninstall(["react-hooks"], deps, factory);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [uninstallData, uninstallCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(uninstallData).toEqual({
      skillName: "react-hooks",
      removedPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(uninstallCtx.outputFormat).toBe("text");
  });

  it("respects --project and --global scopes", async () => {
    const projectDeps = createDeps();
    const projectFactory = createFactoryDeps();
    await runUninstall(
      ["react-hooks", "--project"],
      projectDeps,
      projectFactory
    );
    expect(projectDeps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });

    const globalDeps = createDeps();
    const globalFactory = createFactoryDeps();
    await runUninstall(["react-hooks", "--global"], globalDeps, globalFactory);
    expect(globalDeps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUninstall(["react-hooks", "--dir", "/work/demo"], deps, factory);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("supports --json output for uninstall results", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUninstall(["react-hooks", "--json"], deps, factory);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [uninstallJsonData, uninstallJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(uninstallJsonData).toEqual({
      skillName: "react-hooks",
      removedPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(uninstallJsonCtx.outputFormat).toBe("json");
  });

  it("handles skill-not-found errors gracefully", async () => {
    const deps = createDeps({
      uninstallSkill: mock(async () => {
        throw new Error('Skill "react-hooks" is not installed.');
      }),
    });
    const factory = createFactoryDeps();

    await runUninstall(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Skill "react-hooks" is not installed.'
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully", async () => {
    const deps = createDeps({
      uninstallSkill: mock(async () => {
        throw "timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runUninstall(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("skill list command", () => {
  it("reads installed skills and prints a human-readable list in default mode", async () => {
    const listSkills = mock(async () => [
      {
        name: "react-hooks",
        title: "React Hooks",
        version: "1.2.3",
      },
      {
        name: "seo-blog-writer",
        title: "SEO Blog Writer",
        version: "2.0.0",
      },
    ]);
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList([], deps, factory);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.installSkill).not.toHaveBeenCalled();
    expect(deps.uninstallSkill).not.toHaveBeenCalled();
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [listData, listCtx] = (factory.printResult as ReturnType<typeof mock>)
      .mock.calls[0] as [unknown, { outputFormat: string }];
    expect(listData).toEqual([
      { name: "react-hooks", title: "React Hooks", version: "1.2.3" },
      { name: "seo-blog-writer", title: "SEO Blog Writer", version: "2.0.0" },
    ]);
    expect(listCtx.outputFormat).toBe("text");
  });

  it("forwards --project and --global scopes to list mode", async () => {
    const projectListSkills = mock(async () => []);
    const projectDeps = createDeps({
      listSkills: projectListSkills,
    });

    await runList(["--project"], projectDeps, createFactoryDeps());

    expect(projectListSkills).toHaveBeenCalledWith({
      scope: { type: "project" },
    });

    const globalListSkills = mock(async () => []);
    const globalDeps = createDeps({
      listSkills: globalListSkills,
    });

    await runList(["--global"], globalDeps, createFactoryDeps());

    expect(globalListSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });

    await runList(["--dir", "/work/demo"], deps, createFactoryDeps());

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("supports --json output for list results", async () => {
    const listSkills = mock(async () => [
      {
        name: "react-hooks",
        title: "React Hooks",
        version: "1.2.3",
      },
    ]);
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList(["--json"], deps, factory);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [listJsonData, listJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(listJsonData).toEqual([
      { name: "react-hooks", title: "React Hooks", version: "1.2.3" },
    ]);
    expect(listJsonCtx.outputFormat).toBe("json");
  });

  it("outputs an empty JSON array in --json mode when no skills are installed", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList(["--json"], deps, factory);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [emptyJsonData, emptyJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(emptyJsonData).toEqual([]);
    expect(emptyJsonCtx.outputFormat).toBe("json");
  });

  it("prints an empty-state message when no installed skills are found", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList([], deps, factory);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [emptyMsg] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(emptyMsg as string).toContain("No installed skills found.");
  });

  it("handles list errors gracefully and sets exit code", async () => {
    const listSkills = mock(async () => {
      throw new Error("Failed to read skills directory");
    });
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList([], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Skill command failed: Failed to read skills directory"
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables in list mode", async () => {
    const listSkills = mock(async () => {
      throw "timeout";
    });
    const deps = createDeps({
      listSkills,
    });
    const factory = createFactoryDeps();

    await runList([], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("skill update command", () => {
  it("does not register --version option", () => {
    const command = createSkillCommand();
    const updateCommand = command.commands.find(
      (subcommand) => subcommand.name() === "update"
    );

    expect(updateCommand).toBeDefined();
    expect(
      updateCommand?.options.some((option) => option.long === "--version")
    ).toBe(false);
  });

  it("fails when neither skill name nor --all is provided", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate([], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Please provide a skill name or pass "--all" to update all installed skills.'
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.updateSkill).not.toHaveBeenCalled();
    expect(deps.updateAllSkills).not.toHaveBeenCalled();
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("updates a single skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [updateData, updateCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateData).toContain("react-hooks");
    expect(updateData).toContain("updated");
    expect(updateData).toContain("c776916");
    expect(updateData).toContain("a1b2c3d");
    expect(updateCtx.outputFormat).toBe("text");
  });

  it("prints a no-op message when skill is already at the latest version (updated: false)", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => ({
        skillName: "react-hooks",
        updated: false,
      })),
    });
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(factory.printResult).toHaveBeenCalled();
    const [noopData] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(noopData).toContain("react-hooks");
    expect(noopData).toContain("up to date");
  });

  it("forwards --force flag to updateSkill", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--force"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
      force: true,
    });
  });

  it("calls updateAllSkills when --all flag is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["--all"], deps, factory);

    expect(deps.updateAllSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.updateSkill).not.toHaveBeenCalled();
  });

  it("forwards --force with --all to updateAllSkills", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["--all", "--force"], deps, factory);

    expect(deps.updateAllSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
      force: true,
    });
  });

  it("forwards --project scope when --project is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--project"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });
  });

  it("forwards --global scope when --global is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--global"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--dir", "/work/demo"], deps, factory);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("outputs structured JSON result in --json mode for single skill update", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [updateJsonData, updateJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateJsonData).toEqual({
      skillName: "react-hooks",
      updated: true,
      from: "c776916",
      to: "a1b2c3d",
    });
    expect(updateJsonCtx.outputFormat).toBe("json");
  });

  it("outputs structured JSON array in --json mode for --all updates", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["--all", "--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [updateAllJsonData, updateAllJsonCtx] = (
      factory.printResult as ReturnType<typeof mock>
    ).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateAllJsonData).toEqual([
      {
        skillName: "react-hooks",
        updated: true,
        from: "c776916",
        to: "a1b2c3d",
      },
    ]);
    expect(updateAllJsonCtx.outputFormat).toBe("json");
  });

  it("handles skill-not-installed errors gracefully", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw new Error('Skill "react-hooks" is not installed.');
      }),
    });
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Skill "react-hooks" is not installed.'
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully for single skill update", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw new Error("Registry unavailable");
      }),
    });
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Registry unavailable")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully in update mode", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw "timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("fails when a skill name is provided with --all", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runUpdate(["react-hooks", "--all"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Cannot use "--all" together with a specific skill name.'
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.updateSkill).not.toHaveBeenCalled();
    expect(deps.updateAllSkills).not.toHaveBeenCalled();
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});

describe("skill search command", () => {
  it("does not register --version option", () => {
    const command = createSkillCommand();
    const searchCommand = command.commands.find(
      (subcommand) => subcommand.name() === "search"
    );

    expect(searchCommand).toBeDefined();
    expect(
      searchCommand?.options.some((option) => option.long === "--version")
    ).toBe(false);
  });

  it("searches with a query and prints result in default mode", async () => {
    const searchResult = {
      rows: [{ name: "react-hooks", title: "React Hooks" }],
    };
    const deps = createDeps({
      search: mock(async () => searchResult),
    });
    const factory = createFactoryDeps();

    await runSearch(["react"], deps, factory);

    expect(deps.validateQuery).toHaveBeenCalledWith("react");
    expect(deps.search).toHaveBeenCalledWith("react", {});
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual(searchResult);
    expect(ctx.outputFormat).toBe("text");
  });

  it("forwards --type filter to search", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(["hooks", "--type", "text"], deps, factory);

    expect(deps.search).toHaveBeenCalledWith("hooks", { type: "text" });
  });

  it("forwards --author filter to search", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(["hooks", "--author", "alice"], deps, factory);

    expect(deps.search).toHaveBeenCalledWith("hooks", { author: "alice" });
  });

  it("outputs structured JSON result in --json mode", async () => {
    const searchResult = { rows: [{ name: "react-hooks" }] };
    const deps = createDeps({
      search: mock(async () => searchResult),
    });
    const factory = createFactoryDeps();

    await runSearch(["react", "--json"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual(searchResult);
    expect(ctx.outputFormat).toBe("json");
  });

  it("handles search service errors gracefully", async () => {
    const deps = createDeps({
      search: mock(async () => {
        throw new Error("Registry unavailable");
      }),
    });
    const factory = createFactoryDeps();

    await runSearch(["react"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Registry unavailable")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully", async () => {
    const deps = createDeps({
      search: mock(async () => {
        throw "timeout";
      }),
    });
    const factory = createFactoryDeps();

    await runSearch(["react"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: timeout")
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });

  it("handles invalid --type filter gracefully", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(["hooks", "--type", "invalid-type"], deps, factory);

    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Invalid skill type "invalid-type"'
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
    expect(factory.printResult).not.toHaveBeenCalled();
  });
});
