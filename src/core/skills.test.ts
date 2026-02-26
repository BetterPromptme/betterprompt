import { describe, expect, it, mock } from "bun:test";
import { searchSkills, validateSearchQuery } from "./skills";

describe("skills core", () => {
  it("validates and normalizes query", () => {
    expect(validateSearchQuery("  react  ")).toBe("react");
  });

  it("throws when query is shorter than 3 chars", () => {
    expect(() => validateSearchQuery("ab")).toThrow(
      "Search query must be at least 3 characters."
    );
  });

  it("calls api client get with normalized query", async () => {
    const apiClient = {
      get: mock(async () => ({
        rows: [],
      })),
    } as Parameters<typeof searchSkills>[0];

    await searchSkills(apiClient, "react");

    expect(apiClient.get).toHaveBeenCalledWith("/skills", {
      query: {
        q: "react",
      },
    });
  });
});
