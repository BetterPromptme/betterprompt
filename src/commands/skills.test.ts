import { describe, expect, it, mock } from "bun:test";
import { createSkillsCommand } from "./skills";

type TSkillsDeps = NonNullable<Parameters<typeof createSkillsCommand>[0]>;

const createDeps = (overrides: Partial<TSkillsDeps> = {}): TSkillsDeps => ({
  getSkill: mock(async () => ({
    skillId: "abc123",
    title: "React Hooks",
    description: "A guide to React hooks",
    name: "react-hooks",
    skillmd: "# React Hooks",
  })),
  log: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runInfo = async (args: string[], deps: TSkillsDeps) => {
  const command = createSkillsCommand(deps);
  await command.parseAsync(["info", ...args], { from: "user" });
};

describe("skills command", () => {
  it("fetches skill by id and prints json result", async () => {
    const deps = createDeps();

    await runInfo(["abc123"], deps);

    expect(deps.getSkill).toHaveBeenCalledWith("abc123");
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          skillId: "abc123",
          title: "React Hooks",
          description: "A guide to React hooks",
          name: "react-hooks",
          skillmd: "# React Hooks",
        },
        null,
        2
      )
    );
  });

  it("logs error and sets exit code when getSkill throws", async () => {
    const deps = createDeps({
      getSkill: mock(async () => {
        throw new Error("Skill not found");
      }),
    });

    await runInfo(["unknown-id"], deps);

    expect(deps.error).toHaveBeenCalledWith(
      "Skills command failed: Skill not found"
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.log).not.toHaveBeenCalled();
  });

  it("logs error and sets exit code when skillId is empty string", async () => {
    const deps = createDeps({
      getSkill: mock(async () => {
        throw new Error("Skill ID must not be empty.");
      }),
    });

    await runInfo([""], deps);

    expect(deps.error).toHaveBeenCalledWith(
      "Skills command failed: Skill ID must not be empty."
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
