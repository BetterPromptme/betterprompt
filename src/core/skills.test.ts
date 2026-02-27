import { describe, expect, it, mock } from "bun:test";
import { getSkillById, searchSkills, validateSearchQuery } from "./skills";

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
        status: "SUCCESS",
        data: { rows: [] },
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

describe("getSkillById", () => {
  it("calls api client get with the skill ID", async () => {
    const skillDetail = {
      skillId: "abc123",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      skillmd: "# React Hooks\n...",
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillById>[0];

    const result = await getSkillById(apiClient, "abc123");

    expect(apiClient.get).toHaveBeenCalledWith("/skills/abc123");
    expect(result).toEqual(skillDetail);
  });

  it("throws when skillId is empty", async () => {
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: undefined })),
    } as Parameters<typeof getSkillById>[0];

    await expect(getSkillById(apiClient, "")).rejects.toThrow(
      "Skill ID must not be empty."
    );
  });

  it("throws when skillId is whitespace only", async () => {
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: undefined })),
    } as Parameters<typeof getSkillById>[0];

    await expect(getSkillById(apiClient, "   ")).rejects.toThrow(
      "Skill ID must not be empty."
    );
  });

  it("throws when api returns non-SUCCESS status", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "ERROR",
        message: "Skill not found",
      })),
    } as Parameters<typeof getSkillById>[0];

    await expect(getSkillById(apiClient, "unknown-id")).rejects.toThrow(
      "Skill not found"
    );
  });
});
