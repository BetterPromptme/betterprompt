import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import { createProgram } from "../../cli";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createSkillCommand } from "../skill/command";
import { createSearchCommand } from "./command";

type TSearchDeps = NonNullable<Parameters<typeof createSearchCommand>[0]>;
type TSkillDeps = NonNullable<Parameters<typeof createSkillCommand>[0]>;

const sampleRows = [
  {
    skillId: "s_1",
    title: "React Prompt",
    description: "React skill",
    name: "react",
  },
];

const createDeps = (overrides: Partial<TSearchDeps> = {}): TSearchDeps => ({
  validateQuery: mock((query: string) => query.trim()),
  search: mock(async () => ({ rows: sampleRows })),
  ...overrides,
});

const createSkillDeps = (searchDeps: TSearchDeps): TSkillDeps => ({
  validateQuery: searchDeps.validateQuery,
  search: searchDeps.search,
  getSkill: mock(async () => ({})),
  installSkill: mock(async () => ({})),
  uninstallSkill: mock(async () => ({})),
  listSkills: mock(async () => []),
  updateSkill: mock(async () => ({
    skillName: "",
    updated: false,
  })),
  updateAllSkills: mock(async () => []),
});

const runSearch = async (
  args: string[],
  deps: TSearchDeps,
  factoryDeps: Partial<TCommandFactoryDeps> = createFactoryDeps()
) => {
  const root = new Command()
    .name("betterprompt")
    .option("--json", "Render output as JSON");
  root.addCommand(createSearchCommand(deps, factoryDeps));
  await root.parseAsync(["node", "betterprompt", ...args]);
};

const runProgram = async (
  args: string[],
  deps: TSearchDeps,
  factoryDeps: Partial<TCommandFactoryDeps> = createFactoryDeps()
) => {
  const root = new Command()
    .name("betterprompt")
    .option("--json", "Render output as JSON");
  root.addCommand(createSearchCommand(deps, factoryDeps));
  root.addCommand(createSkillCommand(createSkillDeps(deps)));
  await root.parseAsync(["node", "betterprompt", ...args]);
};

describe("search command", () => {
  afterEach(() => {
    mock.restore();
  });

  it("imports skill search behavior from services/skills", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/commands/search/command.ts"),
      "utf8"
    );

    expect(source.includes("../../core/skills")).toBe(false);
    expect(source.includes("../../services/skills/service")).toBe(true);
  });

  it("forwards --author and --type flags to search layer", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(
      ["search", "react", "--type", "text", "--author", "alice"],
      deps,
      factory
    );

    expect(deps.validateQuery).toHaveBeenCalledWith("react");
    expect(deps.search).toHaveBeenCalledWith("react", {
      type: "text",
      author: "alice",
    });
  });

  it.each(["image", "video", "text"] as const)(
    "accepts valid skill type --%s",
    async (skillType) => {
      const deps = createDeps();

      await runSearch(["search", "react", "--type", skillType], deps);

      expect(deps.search).toHaveBeenCalledWith("react", { type: skillType });
    }
  );

  it("rejects invalid --type value and sets exit code", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(["search", "react", "--type", "workflow"], deps, factory);

    expect(deps.search).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid skill type "workflow"')
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });

  it("supports --json structured output", async () => {
    const deps = createDeps();
    const factory = createFactoryDeps();

    await runSearch(["--json", "search", "react"], deps, factory);

    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({ rows: sampleRows });
    expect(ctx.outputFormat).toBe("json");
  });

  it("handles empty results without error", async () => {
    const deps = createDeps({
      search: mock(async () => ({ rows: [] })),
    });
    const factory = createFactoryDeps();

    await runSearch(["search", "no-matches"], deps, factory);

    expect(deps.search).toHaveBeenCalledWith("no-matches", {});
    expect(factory.error).not.toHaveBeenCalled();
    expect(factory.setExitCode).not.toHaveBeenCalled();
    expect(factory.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({ rows: [] });
    expect(ctx.outputFormat).toBe("text");
  });

  it("registers canonical skill search subcommand with only --author and --type", () => {
    const skillCommand = createSkillCommand() as unknown as {
      commands: Array<{
        name: () => string;
        options: Array<{ long?: string }>;
      }>;
    };

    const searchSubcommand = skillCommand.commands.find(
      (subcommand) => subcommand.name() === "search"
    );

    expect(searchSubcommand).toBeDefined();
    expect(
      searchSubcommand?.options.some((option) => option.long === "--type")
    ).toBe(true);
    expect(
      searchSubcommand?.options.some((option) => option.long === "--author")
    ).toBe(true);
    expect(
      searchSubcommand?.options.some((option) => option.long === "--tag")
    ).toBe(false);
    expect(
      searchSubcommand?.options.some((option) => option.long === "--model")
    ).toBe(false);
    expect(
      searchSubcommand?.options.some((option) => option.long === "--verified")
    ).toBe(false);
    expect(
      searchSubcommand?.options.some((option) => option.long === "--limit")
    ).toBe(false);
  });

  it("keeps top-level search as alias alongside skill search", () => {
    const program = createProgram();
    const searchCommand = program.commands.find(
      (command) => command.name() === "search"
    );
    const skillCommand = program.commands.find(
      (command) => command.name() === "skill"
    );
    const skillSearch = skillCommand?.commands.find(
      (command) => command.name() === "search"
    );

    expect(searchCommand).toBeDefined();
    expect(skillSearch).toBeDefined();
  });

  it("supports canonical skill search execution with --author and --type filters", async () => {
    const deps = createDeps();

    await runProgram(
      ["skill", "search", "react", "--type", "image", "--author", "alice"],
      deps
    );

    expect(deps.search).toHaveBeenCalledWith("react", {
      type: "image",
      author: "alice",
    });
  });

  it("returns error and sets exit code when validation fails", async () => {
    const deps = createDeps({
      validateQuery: mock(() => {
        throw new Error("Search query must be at least 3 characters.");
      }),
    });
    const factory = createFactoryDeps();

    await runSearch(["search", "ab"], deps, factory);

    expect(deps.search).not.toHaveBeenCalled();
    expect(factory.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Search command failed: Search query must be at least 3 characters."
      )
    );
    expect(factory.setExitCode).toHaveBeenCalledWith(1);
  });
});
