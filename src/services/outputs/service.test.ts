import { describe, expect, it } from "bun:test";
import { RunStatus } from "../../enums";
import {
  buildOutputsListQuery,
  createDefaultOutputsCommandDependencies,
} from "./service";

describe("services/outputs/service", () => {
  it("builds remote list query with limit only", () => {
    expect(
      buildOutputsListQuery({
        status: RunStatus.Succeeded,
        since: "2026-03-01",
        limit: 5,
        remote: true,
      })
    ).toEqual({ limit: 5 });
  });

  it("creates default outputs dependencies for command wiring", () => {
    const deps = createDefaultOutputsCommandDependencies();

    expect(typeof deps.resolveScope).toBe("function");
    expect(typeof deps.fetchRun).toBe("function");
    expect(typeof deps.listOutputs).toBe("function");
    expect(typeof deps.readHistoryEntries).toBe("function");
    expect(typeof deps.printResult).toBe("function");
    expect(typeof deps.error).toBe("function");
    expect(typeof deps.setExitCode).toBe("function");
  });
});
