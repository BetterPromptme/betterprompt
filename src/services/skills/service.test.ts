import { describe, expect, it, mock } from "bun:test";

import { getSkillByName, searchSkills, validateSearchQuery } from "./service";

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

  it("returns rows when api call succeeds", async () => {
    const rows = [
      {
        skillId: "abc123",
        latestPromptVersionId: "1.0.0",
        title: "React Hooks",
        description: "A guide to React hooks",
        name: "react-hooks",
        author: null,
        sample: { inputs: null, outputs: null },
        metadata: { skillmdUrl: "https://example.com/SKILL.md" },
      },
    ];

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: { rows },
      })),
    } as Parameters<typeof searchSkills>[0];

    await expect(searchSkills(apiClient, "react")).resolves.toEqual(rows);
  });

  it("forwards --type and --author filters as query params", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: { rows: [] },
      })),
    } as Parameters<typeof searchSkills>[0];

    await searchSkills(apiClient, "react", {
      type: "image",
      author: "alice",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/skills", {
      query: {
        q: "react",
        type: "image",
        author: "alice",
      },
    });
  });

  it("omits undefined filter values", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: { rows: [] },
      })),
    } as Parameters<typeof searchSkills>[0];

    await searchSkills(apiClient, "react", {
      type: undefined,
      author: "alice",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/skills", {
      query: {
        q: "react",
        author: "alice",
      },
    });
  });
});

describe("getSkillByName", () => {
  it("calls api client get with the skill name", async () => {
    const skillDetail = {
      skillId: "abc123",
      latestPromptVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      metadata: {
        skillmdUrl:
          "https://raw.githubusercontent.com/org/repo/abc123/skills/react-hooks/SKILL.md",
      },
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillByName>[0];

    const result = await getSkillByName(apiClient, "react-hooks");

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks");
    expect(result).toEqual(skillDetail);
  });

  it("trims surrounding whitespace from skill name before api request", async () => {
    const skillDetail = {
      skillId: "abc123",
      latestPromptVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      metadata: {
        skillmdUrl:
          "https://raw.githubusercontent.com/org/repo/abc123/skills/react-hooks/SKILL.md",
      },
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillByName>[0];

    await getSkillByName(apiClient, "  react-hooks  ");

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks");
  });

  it("throws when skill name is empty", async () => {
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: undefined })),
    } as Parameters<typeof getSkillByName>[0];

    await expect(getSkillByName(apiClient, "")).rejects.toThrow(
      "Skill name must not be empty."
    );
  });

  it("throws when skill name is whitespace only", async () => {
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: undefined })),
    } as Parameters<typeof getSkillByName>[0];

    await expect(getSkillByName(apiClient, "   ")).rejects.toThrow(
      "Skill name must not be empty."
    );
  });
});
