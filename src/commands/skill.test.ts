import { describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { createSkillCommand } from "./skills";

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
  version?: string;
};

type TSkillUpdateResult = {
  skillName: string;
  fromVersion: string | undefined;
  toVersion: string;
  updated: boolean;
};

type TSkillUpdateOptions = {
  scope: TSkillInstallOptions["scope"];
  force?: boolean;
};

type TSkillUpdateAllOptions = {
  scope: TSkillInstallOptions["scope"];
  force?: boolean;
};

type TSkillCommandDeps = NonNullable<Parameters<typeof createSkillCommand>[0]> & {
  installSkill: (
    skillName: string,
    options: TSkillInstallOptions
  ) => Promise<unknown>;
  uninstallSkill: (
    skillName: string,
    options: { scope: TSkillInstallOptions["scope"] }
  ) => Promise<unknown>;
  listSkills: (options: TSkillListOptions) => Promise<TSkillSummary[]>;
  updateSkill: (skillName: string, options: TSkillUpdateOptions) => Promise<TSkillUpdateResult>;
  updateAllSkills: (options: TSkillUpdateAllOptions) => Promise<TSkillUpdateResult[]>;
};

const createDeps = (overrides: Partial<TSkillCommandDeps> = {}): TSkillCommandDeps => ({
  getSkill: mock(async () => ({
    skillId: "abc123",
    title: "React Hooks",
    description: "A guide to React hooks",
    name: "react-hooks",
    skillmd: "# React Hooks",
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
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    updated: true,
  })),
  updateAllSkills: mock(async () => [
    {
      skillName: "react-hooks",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      updated: true,
    },
  ]),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runInstall = async (args: string[], deps: TSkillCommandDeps) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .addCommand(createSkillCommand(deps));

  await root.parseAsync(["skill", "install", ...args], { from: "user" });
};

const runUninstall = async (args: string[], deps: TSkillCommandDeps) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .addCommand(createSkillCommand(deps));

  await root.parseAsync(["skill", "uninstall", ...args], { from: "user" });
};

const runList = async (args: string[], deps: TSkillCommandDeps) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .addCommand(createSkillCommand(deps));

  await root.parseAsync(["skill", "list", ...args], { from: "user" });
};

const runUpdate = async (args: string[], deps: TSkillCommandDeps) => {
  const root = new Command("betterprompt");
  root
    .option("--project")
    .option("--global")
    .option("--dir <path>")
    .option("--json")
    .addCommand(createSkillCommand(deps));

  await root.parseAsync(["skill", "update", ...args], { from: "user" });
};

describe("skill install command", () => {
  it("installs a skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks"], deps);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [installData, installCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(installData).toEqual({
      skillName: "react-hooks",
      installPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(installCtx.outputFormat).toBe("text");
  });

  it("does not forward optional flags when they are not provided", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks"], deps);

    const [, options] = (deps.installSkill as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      TSkillInstallOptions
    ];
    expect(options.overwrite).toBeUndefined();
  });

  it("supports --json output for install results", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks", "--json"], deps);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [installJsonData, installJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(installJsonData).toEqual({
      skillName: "react-hooks",
      installPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(installJsonCtx.outputFormat).toBe("json");
  });

  it("forwards project scope when --project is used", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks", "--project"], deps);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });
  });

  it("forwards global scope when --global is used", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks", "--global"], deps);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks", "--dir", "/work/demo"], deps);

    expect(deps.installSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("forwards --overwrite flag", async () => {
    const deps = createDeps();

    await runInstall(["react-hooks", "--overwrite"], deps);

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

    await runInstall(["   "], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Skill name must not be empty.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully", async () => {
    const deps = createDeps({
      installSkill: mock(async () => {
        throw new Error("Registry unavailable");
      }),
    });

    await runInstall(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Registry unavailable")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully", async () => {
    const deps = createDeps({
      installSkill: mock(async () => {
        throw "timeout";
      }),
    });

    await runInstall(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Skill command failed: timeout"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});

describe("skill uninstall command", () => {
  it("uninstalls a skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();

    await runUninstall(["react-hooks"], deps);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [uninstallData, uninstallCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(uninstallData).toEqual({
      skillName: "react-hooks",
      removedPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(uninstallCtx.outputFormat).toBe("text");
  });

  it("respects --project and --global scopes", async () => {
    const projectDeps = createDeps();
    await runUninstall(["react-hooks", "--project"], projectDeps);
    expect(projectDeps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });

    const globalDeps = createDeps();
    await runUninstall(["react-hooks", "--global"], globalDeps);
    expect(globalDeps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();

    await runUninstall(["react-hooks", "--dir", "/work/demo"], deps);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("supports --json output for uninstall results", async () => {
    const deps = createDeps();

    await runUninstall(["react-hooks", "--json"], deps);

    expect(deps.uninstallSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [uninstallJsonData, uninstallJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(uninstallJsonData).toEqual({
      skillName: "react-hooks",
      removedPath: "/tmp/project/.betterprompt/skills/react-hooks",
    });
    expect(uninstallJsonCtx.outputFormat).toBe("json");
  });

  it("handles skill-not-found errors gracefully", async () => {
    const deps = createDeps({
      uninstallSkill: mock(async () => {
        throw new Error("Skill \"react-hooks\" is not installed.");
      }),
    });

    await runUninstall(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Skill \"react-hooks\" is not installed.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully", async () => {
    const deps = createDeps({
      uninstallSkill: mock(async () => {
        throw "timeout";
      }),
    });

    await runUninstall(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Skill command failed: timeout"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
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

    await runList([], deps);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.installSkill).not.toHaveBeenCalled();
    expect(deps.uninstallSkill).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [listData, listCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
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

    await runList(["--project"], projectDeps);

    expect(projectListSkills).toHaveBeenCalledWith({
      scope: { type: "project" },
    });

    const globalListSkills = mock(async () => []);
    const globalDeps = createDeps({
      listSkills: globalListSkills,
    });

    await runList(["--global"], globalDeps);

    expect(globalListSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });

    await runList(["--dir", "/work/demo"], deps);

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

    await runList(["--json"], deps);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [listJsonData, listJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(listJsonData).toEqual([{ name: "react-hooks", title: "React Hooks", version: "1.2.3" }]);
    expect(listJsonCtx.outputFormat).toBe("json");
  });

  it("outputs an empty JSON array in --json mode when no skills are installed", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });

    await runList(["--json"], deps);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [emptyJsonData, emptyJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(emptyJsonData).toEqual([]);
    expect(emptyJsonCtx.outputFormat).toBe("json");
  });

  it("prints an empty-state message when no installed skills are found", async () => {
    const listSkills = mock(async () => []);
    const deps = createDeps({
      listSkills,
    });

    await runList([], deps);

    expect(listSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [emptyMsg] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(emptyMsg as string).toContain("No installed skills found.");
  });

  it("handles list errors gracefully and sets exit code", async () => {
    const listSkills = mock(async () => {
      throw new Error("Failed to read skills directory");
    });
    const deps = createDeps({
      listSkills,
    });

    await runList([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Failed to read skills directory")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables in list mode", async () => {
    const listSkills = mock(async () => {
      throw "timeout";
    });
    const deps = createDeps({
      listSkills,
    });

    await runList([], deps);

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Skill command failed: timeout"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});

describe("skill update command", () => {
  it("fails when neither skill name nor --all is provided", async () => {
    const deps = createDeps();

    await runUpdate([], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Please provide a skill name or pass "--all" to update all installed skills.'
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.updateSkill).not.toHaveBeenCalled();
    expect(deps.updateAllSkills).not.toHaveBeenCalled();
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("updates a single skill and prints human-readable output in default mode", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [updateData, updateCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateData).toEqual({
      skillName: "react-hooks",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      updated: true,
    });
    expect(updateCtx.outputFormat).toBe("text");
  });

  it("prints a no-op message when skill is already at the latest version (updated: false)", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => ({
        skillName: "react-hooks",
        fromVersion: "2.0.0",
        toVersion: "2.0.0",
        updated: false,
      })),
    });

    await runUpdate(["react-hooks"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
    expect(deps.printResult).toHaveBeenCalled();
    const [noopData] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    const noopStr = JSON.stringify(noopData);
    expect(noopStr).toContain("react-hooks");
    expect(noopStr).toContain("2.0.0");
  });

  it("forwards --force flag to updateSkill", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--force"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
      force: true,
    });
  });

  it("calls updateAllSkills when --all flag is used", async () => {
    const deps = createDeps();

    await runUpdate(["--all"], deps);

    expect(deps.updateAllSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
    });
    expect(deps.updateSkill).not.toHaveBeenCalled();
  });

  it("forwards --force with --all to updateAllSkills", async () => {
    const deps = createDeps();

    await runUpdate(["--all", "--force"], deps);

    expect(deps.updateAllSkills).toHaveBeenCalledWith({
      scope: { type: "global" },
      force: true,
    });
  });

  it("forwards --project scope when --project is used", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--project"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "project" },
    });
  });

  it("forwards --global scope when --global is used", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--global"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "global" },
    });
  });

  it("forwards explicit dir scope when --dir is used", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--dir", "/work/demo"], deps);

    expect(deps.updateSkill).toHaveBeenCalledWith("react-hooks", {
      scope: { type: "dir", path: "/work/demo" },
    });
  });

  it("outputs structured JSON result in --json mode for single skill update", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [updateJsonData, updateJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateJsonData).toEqual({
      skillName: "react-hooks",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      updated: true,
    });
    expect(updateJsonCtx.outputFormat).toBe("json");
  });

  it("outputs structured JSON array in --json mode for --all updates", async () => {
    const deps = createDeps();

    await runUpdate(["--all", "--json"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [updateAllJsonData, updateAllJsonCtx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(updateAllJsonData).toEqual([
      { skillName: "react-hooks", fromVersion: "1.0.0", toVersion: "2.0.0", updated: true },
    ]);
    expect(updateAllJsonCtx.outputFormat).toBe("json");
  });

  it("handles skill-not-installed errors gracefully", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw new Error('Skill "react-hooks" is not installed.');
      }),
    });

    await runUpdate(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining('Skill command failed: Skill "react-hooks" is not installed.')
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully for single skill update", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw new Error("Registry unavailable");
      }),
    });

    await runUpdate(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Skill command failed: Registry unavailable")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("handles non-Error throwables gracefully in update mode", async () => {
    const deps = createDeps({
      updateSkill: mock(async () => {
        throw "timeout";
      }),
    });

    await runUpdate(["react-hooks"], deps);

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Skill command failed: timeout"));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("fails when a skill name is provided with --all", async () => {
    const deps = createDeps();

    await runUpdate(["react-hooks", "--all"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skill command failed: Cannot use "--all" together with a specific skill name.'
      )
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.updateSkill).not.toHaveBeenCalled();
    expect(deps.updateAllSkills).not.toHaveBeenCalled();
    expect(deps.printResult).not.toHaveBeenCalled();
  });
});
