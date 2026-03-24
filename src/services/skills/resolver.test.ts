import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, mock } from "bun:test";

import { resolvePromptVersionId } from "./resolver";
import type { TSkillSearchApi } from "./types";

describe("resolvePromptVersionId", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    mock.restore();
  });

  const setup = async (slug: string, manifest: unknown) => {
    tempDir = path.join(tmpdir(), `resolver-test-${Date.now()}`);
    const skillDir = path.join(tempDir, "skills", slug);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify(manifest),
      "utf8"
    );
    return tempDir;
  };

  const createMockApiClient = (response: unknown): TSkillSearchApi => ({
    get: mock(() =>
      Promise.resolve({ status: "SUCCESS", data: response })
    ) as TSkillSearchApi["get"],
  });

  it("returns latestPromptVersionId from local manifest", async () => {
    const rootDir = await setup("seo-blog-writer", {
      latestPromptVersionId: "01999ed9-2c81-7d1e-b98d-7b6da814d9c1",
      name: "seo-blog-writer",
      title: "SEO Blog Writer",
    });

    const mockApi = createMockApiClient({});
    const result = await resolvePromptVersionId(
      "seo-blog-writer",
      rootDir,
      mockApi
    );

    expect(result).toBe("01999ed9-2c81-7d1e-b98d-7b6da814d9c1");
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("falls back to API when skill is not installed locally", async () => {
    tempDir = path.join(tmpdir(), `resolver-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const mockApi = createMockApiClient({
      latestPromptVersionId: "api-resolved-version-id",
      name: "remote-skill",
      metadata: { skillmdUrl: "https://example.com/SKILL.md" },
    });

    const result = await resolvePromptVersionId(
      "remote-skill",
      tempDir,
      mockApi
    );

    expect(result).toBe("api-resolved-version-id");
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to API when manifest is missing latestPromptVersionId", async () => {
    const rootDir = await setup("broken-skill", {
      name: "broken-skill",
      title: "Broken",
    });

    const mockApi = createMockApiClient({
      latestPromptVersionId: "api-fallback-id",
      name: "broken-skill",
      metadata: { skillmdUrl: "https://example.com/SKILL.md" },
    });

    const result = await resolvePromptVersionId(
      "broken-skill",
      rootDir,
      mockApi
    );

    expect(result).toBe("api-fallback-id");
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to API when latestPromptVersionId is empty string", async () => {
    const rootDir = await setup("empty-version", {
      latestPromptVersionId: "",
      name: "empty-version",
    });

    const mockApi = createMockApiClient({
      latestPromptVersionId: "api-fallback-id",
      name: "empty-version",
      metadata: { skillmdUrl: "https://example.com/SKILL.md" },
    });

    const result = await resolvePromptVersionId(
      "empty-version",
      rootDir,
      mockApi
    );

    expect(result).toBe("api-fallback-id");
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it("throws when API fallback also fails", async () => {
    tempDir = path.join(tmpdir(), `resolver-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const mockApi: TSkillSearchApi = {
      get: mock(() =>
        Promise.resolve({ status: "ERROR", message: "Skill not found" })
      ) as TSkillSearchApi["get"],
    };

    await expect(
      resolvePromptVersionId("unknown-skill", tempDir, mockApi)
    ).rejects.toThrow("Skill not found");
  });
});
