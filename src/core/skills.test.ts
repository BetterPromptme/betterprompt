import { describe, expect, it, mock } from "bun:test";
import { getSkillByName, searchSkills, validateSearchQuery } from "./skills";

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
        skillVersionId: "1.0.0",
        title: "React Hooks",
        description: "A guide to React hooks",
        name: "react-hooks",
        author: null,
        sample: { inputs: null, outputs: null },
        inputMetadata: { variables: {}, images: [] },
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

  it("throws when api returns non-SUCCESS status", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "ERROR",
        message: "Search is unavailable",
      })),
    } as Parameters<typeof searchSkills>[0];

    await expect(searchSkills(apiClient, "react")).rejects.toThrow("Search is unavailable");
  });
});

describe("getSkillByName", () => {
  it("calls api client get with the skill name", async () => {
    const skillDetail = {
      skillId: "abc123",
      skillVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      skillmd: "# React Hooks\n...",
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
      skillVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      skillmd: "# React Hooks\n...",
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

  it("forwards info flags as query params", async () => {
    const skillDetail = {
      skillId: "abc123",
      skillVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      skillmd: "# React Hooks\n...",
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillByName>[0];

    await (
      getSkillByName as unknown as (
        client: Parameters<typeof getSkillByName>[0],
        skillName: string,
        options: Record<string, unknown>
      ) => Promise<unknown>
    )(apiClient, "react-hooks", {
      version: "1.2.3",
      examples: true,
      schema: true,
      pricing: true,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks", {
      query: {
        version: "1.2.3",
        examples: true,
        schema: true,
        pricing: true,
      },
    });
  });

  it("omits undefined info options from query params", async () => {
    const skillDetail = {
      skillId: "abc123",
      skillVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      skillmd: "# React Hooks\n...",
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillByName>[0];

    await (
      getSkillByName as unknown as (
        client: Parameters<typeof getSkillByName>[0],
        skillName: string,
        options: Record<string, unknown>
      ) => Promise<unknown>
    )(apiClient, "react-hooks", {
      version: "1.2.3",
      examples: undefined,
      schema: undefined,
      pricing: true,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks", {
      query: {
        version: "1.2.3",
        pricing: true,
      },
    });
  });

  it("forwards explicit false info flags when provided", async () => {
    const skillDetail = {
      skillId: "abc123",
      skillVersionId: "1.0.0",
      title: "React Hooks",
      description: "A guide to React hooks",
      name: "react-hooks",
      author: null,
      sample: { inputs: null, outputs: null },
      inputMetadata: { variables: {}, images: [] },
      skillmd: "# React Hooks\n...",
    };

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: skillDetail,
      })),
    } as Parameters<typeof getSkillByName>[0];

    await (
      getSkillByName as unknown as (
        client: Parameters<typeof getSkillByName>[0],
        skillName: string,
        options: Record<string, unknown>
      ) => Promise<unknown>
    )(apiClient, "react-hooks", {
      examples: false,
      schema: false,
      pricing: false,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks", {
      query: {
        examples: false,
        schema: false,
        pricing: false,
      },
    });
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

  it("throws when api returns non-SUCCESS status", async () => {
    const apiClient = {
      get: mock(async () => ({
        status: "ERROR",
        message: "Skill not found",
      })),
    } as Parameters<typeof getSkillByName>[0];

    await expect(getSkillByName(apiClient, "react-hooks")).rejects.toThrow(
      "Skill not found"
    );
  });
});
