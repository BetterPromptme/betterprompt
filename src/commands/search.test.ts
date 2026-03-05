import { Command } from "commander";
import { describe, expect, it, mock } from "bun:test";
import { createProgram } from "../cli";
import { createSearchCommand } from "./search";
import { createSkillCommand } from "./skills";

type TSearchDeps = NonNullable<Parameters<typeof createSearchCommand>[0]>;

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
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runSearch = async (args: string[], deps: TSearchDeps) => {
  const root = new Command().name("betterprompt").option("--json", "Render output as JSON");
  root.addCommand(createSearchCommand(deps));
  await root.parseAsync(["node", "betterprompt", ...args]);
};

const runProgram = async (args: string[], deps: TSearchDeps) => {
  const root = new Command().name("betterprompt").option("--json", "Render output as JSON");
  root.addCommand(createSearchCommand(deps));
  root.addCommand(createSkillCommand(deps as unknown as Parameters<typeof createSkillCommand>[0]));
  await root.parseAsync(["node", "betterprompt", ...args]);
};

describe("search command", () => {
  it("forwards --author and --type flags to search layer", async () => {
    const deps = createDeps();

    await runSearch(
      ["search", "react", "--type", "text", "--author", "alice"],
      deps
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

    await runSearch(["search", "react", "--type", "workflow"], deps);

    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid skill type "workflow"')
    );

    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("supports --json structured output", async () => {
    const deps = createDeps();

    await runSearch(["--json", "search", "react"], deps);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({ rows: sampleRows });
    expect(ctx.outputFormat).toBe("json");
  });

  it("handles empty results without error", async () => {
    const deps = createDeps({
      search: mock(async () => ({ rows: [] })),
    });

    await runSearch(["search", "no-matches"], deps);

    expect(deps.search).toHaveBeenCalledWith("no-matches", {});
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual({ rows: [] });
    expect(ctx.outputFormat).toBe("text");
  });

  it("registers canonical skill search subcommand with only --author and --type", () => {
    const skillCommand = createSkillCommand() as unknown as {
      commands: Array<{ name: () => string; options: Array<{ long?: string }> }>;
    };

    const searchSubcommand = skillCommand.commands.find(
      (subcommand) => subcommand.name() === "search"
    );

    expect(searchSubcommand).toBeDefined();
    expect(searchSubcommand?.options.some((option) => option.long === "--type")).toBe(true);
    expect(searchSubcommand?.options.some((option) => option.long === "--author")).toBe(true);
    expect(searchSubcommand?.options.some((option) => option.long === "--tag")).toBe(false);
    expect(searchSubcommand?.options.some((option) => option.long === "--model")).toBe(false);
    expect(searchSubcommand?.options.some((option) => option.long === "--verified")).toBe(false);
    expect(searchSubcommand?.options.some((option) => option.long === "--limit")).toBe(false);
  });

  it("keeps top-level search as alias alongside skill search", () => {
    const program = createProgram();
    const searchCommand = program.commands.find((command) => command.name() === "search");
    const skillCommand = program.commands.find((command) => command.name() === "skill");
    const skillSearch = skillCommand?.commands.find((command) => command.name() === "search");

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

    await runSearch(["search", "ab"], deps);

    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("Search command failed: Search query must be at least 3 characters.")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
