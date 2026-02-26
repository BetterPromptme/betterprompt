import { describe, expect, it, mock } from "bun:test";
import { createSearchCommand } from "./search";

type TSearchDeps = NonNullable<Parameters<typeof createSearchCommand>[0]>;

const createDeps = (overrides: Partial<TSearchDeps> = {}): TSearchDeps => ({
  validateQuery: mock((query: string) => query.trim()),
  search: mock(async () => ({
    rows: [
      {
        promptId: "p_1",
        title: "React Prompt",
        description: "React skill",
        name: "react",
      },
    ],
  })),
  log: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runSearch = async (args: string[], deps: TSearchDeps) => {
  const command = createSearchCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("search command", () => {
  it("searches with normalized query and prints json result", async () => {
    const deps = createDeps();

    await runSearch(["react"], deps);

    expect(deps.validateQuery).toHaveBeenCalledWith("react");
    expect(deps.search).toHaveBeenCalledWith("react");
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          rows: [
            {
              promptId: "p_1",
              title: "React Prompt",
              description: "React skill",
              name: "react",
            },
          ],
        },
        null,
        2
      )
    );
  });

  it("returns error and sets exit code when validation fails", async () => {
    const deps = createDeps({
      validateQuery: mock(() => {
        throw new Error("Search query must be at least 3 characters.");
      }),
    });

    await runSearch(["ab"], deps);

    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      "Search command failed: Search query must be at least 3 characters."
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });
});
