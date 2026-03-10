import { describe, expect, it } from "bun:test";
import { RunStatus } from "../../enums";
import { OUTPUTS_MESSAGES } from "../../constants";
import {
  buildOutputsListQuery,
  createDefaultOutputsCommandDependencies,
  parseSinceToUnixMs,
} from "./service";

describe("parseSinceToUnixMs", () => {
  it("passes through numeric string as-is (unix ms)", () => {
    expect(parseSinceToUnixMs("1700000000000")).toBe(1700000000000);
  });

  it("parses ISO 8601 date string to unix ms", () => {
    expect(parseSinceToUnixMs("2024-01-01")).toBe(
      new Date("2024-01-01").getTime()
    );
  });

  it("parses ISO 8601 datetime string to unix ms", () => {
    expect(parseSinceToUnixMs("2024-06-15T10:30:00Z")).toBe(
      new Date("2024-06-15T10:30:00Z").getTime()
    );
  });

  it("throws for invalid date string", () => {
    expect(() => parseSinceToUnixMs("not-a-date")).toThrow(
      OUTPUTS_MESSAGES.invalidSince
    );
  });
});

describe("buildOutputsListQuery", () => {
  it("includes since as unix ms when ISO date string provided", () => {
    const result = buildOutputsListQuery({ since: "2024-01-01" });
    expect(result.since).toBe(new Date("2024-01-01").getTime());
  });

  it("includes since as-is when numeric string provided", () => {
    const result = buildOutputsListQuery({ since: "1700000000000" });
    expect(result.since).toBe(1700000000000);
  });

  it("omits since when not defined", () => {
    const result = buildOutputsListQuery({ limit: 10 });
    expect("since" in result).toBe(false);
  });

  it("includes status when defined", () => {
    const result = buildOutputsListQuery({ status: RunStatus.Succeeded });
    expect(result.status).toBe(RunStatus.Succeeded);
  });

  it("omits status when not defined", () => {
    const result = buildOutputsListQuery({ limit: 10 });
    expect("status" in result).toBe(false);
  });

  it("includes limit when defined", () => {
    const result = buildOutputsListQuery({ limit: 5 });
    expect(result.limit).toBe(5);
  });

  it("omits limit when not defined", () => {
    const result = buildOutputsListQuery({});
    expect("limit" in result).toBe(false);
  });

  it("includes combined since, status, and limit in query", () => {
    const result = buildOutputsListQuery({
      since: "2026-03-01",
      status: RunStatus.Failed,
      limit: 20,
      remote: true,
    });
    expect(result.since).toBe(new Date("2026-03-01").getTime());
    expect(result.status).toBe(RunStatus.Failed);
    expect(result.limit).toBe(20);
  });

  it("throws for invalid --since value", () => {
    expect(() => buildOutputsListQuery({ since: "not-a-date" })).toThrow(
      OUTPUTS_MESSAGES.invalidSince
    );
  });
});

describe("services/outputs/service", () => {
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
