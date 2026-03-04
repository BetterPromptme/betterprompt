import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installSkill, listSkills, uninstallSkill, updateSkill, updateAllSkills } from "./installer";

type TInstallOptions = {
  skillName: string;
  scope: {
    type: "global" | "project" | "dir";
    rootDir: string;
  };
  pin?: boolean;
  overwrite?: boolean;
};

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "betterprompt-installer-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  mock.restore();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("installer core", () => {
  it("fetches manifest from API, generates schema locally, then writes manifest.json, schema.json, and SKILL.md", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "1.2.3",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# React Hooks\nUse these hooks wisely.",
            },
          };
        }

        return {
          status: "ERROR",
          message: `Unhandled route: ${resource}`,
        };
      }),
    };

    await (
      installSkill as unknown as (
        client: unknown,
        options: TInstallOptions
      ) => Promise<unknown>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
    });

    const skillDir = path.join(rootDir, "skills", "react-hooks");
    const manifestRaw = await readFile(path.join(skillDir, "manifest.json"), "utf8");
    const schemaRaw = await readFile(path.join(skillDir, "schema.json"), "utf8");
    const skillMd = await readFile(path.join(skillDir, "SKILL.md"), "utf8");

    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks");
    expect(apiClient.get).not.toHaveBeenCalledWith("/skills/react-hooks/schema");
    expect(JSON.parse(manifestRaw)).toMatchObject({
      name: "react-hooks",
      skillVersionId: "1.2.3",
    });
    expect(JSON.parse(schemaRaw)).toMatchObject({
      type: "object",
    });
    expect(skillMd).toContain("# React Hooks");
  });

  it("writes version pin into betterprompt.lock when --pin mode is enabled", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# React Hooks",
            },
          };
        }

        return {
          status: "ERROR",
          message: `Unhandled route: ${resource}`,
        };
      }),
    };

    await (
      installSkill as unknown as (
        client: unknown,
        options: TInstallOptions
      ) => Promise<unknown>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "project", rootDir },
      pin: true,
    });

    const lockfileRaw = await readFile(path.join(rootDir, "betterprompt.lock"), "utf8");

    expect(lockfileRaw).toContain("react-hooks");
    expect(lockfileRaw).toContain("2.0.0");
  });

  it("does not write betterprompt.lock when --pin mode is disabled", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# React Hooks",
            },
          };
        }

        return {
          status: "ERROR",
          message: `Unhandled route: ${resource}`,
        };
      }),
    };

    await (
      installSkill as unknown as (
        client: unknown,
        options: TInstallOptions
      ) => Promise<unknown>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "project", rootDir },
    });

    await expect(readFile(path.join(rootDir, "betterprompt.lock"), "utf8")).rejects.toThrow();
  });

  it("throws when skill name is invalid and does not call API", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: {},
      })),
    };

    await expect(
      (
        installSkill as unknown as (
          client: unknown,
          options: TInstallOptions
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "   ",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow();

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("supports overwrite mode when a skill is already installed", async () => {
    const rootDir = await createTempDir();
    const existingDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(existingDir, { recursive: true });
    await writeFile(path.join(existingDir, "SKILL.md"), "# old");

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "3.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# new",
            },
          };
        }

        return {
          status: "ERROR",
          message: `Unhandled route: ${resource}`,
        };
      }),
    };

    await (
      installSkill as unknown as (
        client: unknown,
        options: TInstallOptions
      ) => Promise<unknown>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
      overwrite: true,
    });

    const skillMd = await readFile(
      path.join(rootDir, "skills", "react-hooks", "SKILL.md"),
      "utf8"
    );
    expect(skillMd).toContain("# new");
  });

  it("throws when a skill is already installed and overwrite is disabled", async () => {
    const rootDir = await createTempDir();
    const existingDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(existingDir, { recursive: true });
    await writeFile(path.join(existingDir, "SKILL.md"), "# old");

    const apiClient = {
      get: mock(async () => ({
        status: "SUCCESS",
        data: {},
      })),
    };

    await expect(
      (
        installSkill as unknown as (
          client: unknown,
          options: TInstallOptions
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "react-hooks",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow();
  });

  it("throws a readable error when API fetch fails", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async () => ({
        status: "ERROR",
        message: "Skill not found",
      })),
    };

    await expect(
      (
        installSkill as unknown as (
          client: unknown,
          options: TInstallOptions
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "missing-skill",
        scope: { type: "global", rootDir },
      })
    ).rejects.toThrow("Skill not found");
  });

  it("stops immediately when manifest fetch fails and does not fetch schema", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/missing-skill") {
          return {
            status: "ERROR",
            message: "Skill not found",
          };
        }

        return {
          status: "SUCCESS",
          data: { type: "object" },
        };
      }),
    };

    await expect(
      (
        installSkill as unknown as (
          client: unknown,
          options: TInstallOptions
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "missing-skill",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow("Skill not found");

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith("/skills/missing-skill");
  });

  it("uninstallSkill removes an installed skill directory", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "manifest.json"), "{}");

    const result = await (
      uninstallSkill as unknown as (options: TInstallOptions) => Promise<{
        skillName: string;
        removedPath: string;
      }>
    )({
      skillName: "react-hooks",
      scope: { type: "project", rootDir },
    });

    await expect(readFile(path.join(skillDir, "manifest.json"), "utf8")).rejects.toThrow();
    expect(result).toEqual({
      skillName: "react-hooks",
      removedPath: skillDir,
    });
  });

  it("uninstallSkill removes lockfile entry for skill when present", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    const lockfilePath = path.join(rootDir, "betterprompt.lock");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      lockfilePath,
      JSON.stringify(
        {
          "react-hooks": "1.2.3",
          "vue-composer": "2.0.0",
        },
        null,
        2
      )
    );

    await (
      uninstallSkill as unknown as (options: TInstallOptions) => Promise<unknown>
    )({
      skillName: "react-hooks",
      scope: { type: "global", rootDir },
    });

    const lockfileRaw = await readFile(lockfilePath, "utf8");
    expect(lockfileRaw).not.toContain("react-hooks");
    expect(lockfileRaw).toContain("vue-composer");
  });

  it("uninstallSkill throws when skill is not found", async () => {
    const rootDir = await createTempDir();

    await expect(
      (
        uninstallSkill as unknown as (options: TInstallOptions) => Promise<unknown>
      )({
        skillName: "missing-skill",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow();
  });

  it("listSkills returns an empty array when skills directory does not exist", async () => {
    const rootDir = await createTempDir();

    const result = await listSkills({ scope: { type: "global", rootDir } });

    expect(result).toEqual([]);
  });

  it("listSkills returns an empty array when skills directory is empty", async () => {
    const rootDir = await createTempDir();
    await mkdir(path.join(rootDir, "skills"), { recursive: true });

    const result = await listSkills({ scope: { type: "global", rootDir } });

    expect(result).toEqual([]);
  });

  it("listSkills reads installed skills and parses name, title, version from manifest.json", async () => {
    const rootDir = await createTempDir();
    const reactHooksDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(reactHooksDir, { recursive: true });
    await writeFile(
      path.join(reactHooksDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", title: "React Hooks", skillVersionId: "1.2.3" })
    );

    const seoDir = path.join(rootDir, "skills", "seo-blog-writer");
    await mkdir(seoDir, { recursive: true });
    await writeFile(
      path.join(seoDir, "manifest.json"),
      JSON.stringify({ name: "seo-blog-writer", title: "SEO Blog Writer", skillVersionId: "2.0.0" })
    );

    const result = await listSkills({ scope: { type: "project", rootDir } });

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: "react-hooks", title: "React Hooks", version: "1.2.3" });
    expect(result).toContainEqual({ name: "seo-blog-writer", title: "SEO Blog Writer", version: "2.0.0" });
  });

  it("listSkills handles missing manifest.json gracefully by returning name-only entry", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "orphaned-skill");
    await mkdir(skillDir, { recursive: true });

    const result = await listSkills({ scope: { type: "dir", rootDir } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "orphaned-skill" });
  });

  it("listSkills handles corrupt manifest.json gracefully by returning name-only entry", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "corrupt-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "manifest.json"), "not valid json {{");

    const result = await listSkills({ scope: { type: "dir", rootDir } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "corrupt-skill" });
  });

  it("listSkills skips non-directory entries in the skills folder", async () => {
    const rootDir = await createTempDir();
    const skillsDir = path.join(rootDir, "skills");
    await mkdir(skillsDir, { recursive: true });
    await writeFile(path.join(skillsDir, "readme.txt"), "not a skill");

    const skillDir = path.join(skillsDir, "valid-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "valid-skill", skillVersionId: "1.0.0" })
    );

    const result = await listSkills({ scope: { type: "global", rootDir } });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid-skill");
  });

  it("listSkills returns name-only entry when manifest fields are not strings", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "no-title-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "no-title-skill", title: 42, version: null })
    );

    const result = await listSkills({ scope: { type: "global", rootDir } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "no-title-skill" });
  });
});

describe("updateSkill core", () => {
  it("updates a skill when the API returns a newer version", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "1.0.0" })
    );

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# React Hooks v2",
            },
          };
        }
        if (resource === "/skills/react-hooks/schema") {
          return { status: "SUCCESS", data: { type: "object" } };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    const result = await (
      updateSkill as unknown as (
        client: unknown,
        options: TInstallOptions & { force?: boolean }
      ) => Promise<{ skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean }>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
    });

    expect(result.skillName).toBe("react-hooks");
    expect(result.fromVersion).toBe("1.0.0");
    expect(result.toVersion).toBe("2.0.0");
    expect(result.updated).toBe(true);

    const manifestRaw = await readFile(path.join(skillDir, "manifest.json"), "utf8");
    expect(JSON.parse(manifestRaw)).toMatchObject({ skillVersionId: "2.0.0" });
  });

  it("updates lockfile pinned version when skill was previously pinned", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    const lockfilePath = path.join(rootDir, "betterprompt.lock");

    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "1.0.0" })
    );
    await writeFile(
      lockfilePath,
      JSON.stringify({
        "react-hooks": "1.0.0",
        "seo-writer": "3.0.0",
      })
    );

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# React Hooks v2",
            },
          };
        }
        if (resource === "/skills/react-hooks/schema") {
          return { status: "SUCCESS", data: { type: "object" } };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    await (
      updateSkill as unknown as (
        client: unknown,
        options: TInstallOptions & { force?: boolean }
      ) => Promise<{ skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean }>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
    });

    const lockfileRaw = await readFile(lockfilePath, "utf8");
    expect(JSON.parse(lockfileRaw)).toEqual({
      "react-hooks": "2.0.0",
      "seo-writer": "3.0.0",
    });
  });

  it("returns updated: false and does not re-install when version is already latest", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "2.0.0" })
    );

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "",
            },
          };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    const result = await (
      updateSkill as unknown as (
        client: unknown,
        options: TInstallOptions & { force?: boolean }
      ) => Promise<{ skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean }>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
    });

    expect(result.updated).toBe(false);
    expect(result.fromVersion).toBe("2.0.0");
    expect(result.toVersion).toBe("2.0.0");
    expect(apiClient.get).not.toHaveBeenCalledWith("/skills/react-hooks/schema");
  });

  it("re-installs skill when --force is set even if version matches", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "2.0.0" })
    );
    await writeFile(path.join(skillDir, "SKILL.md"), "# old content");

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# refreshed content",
            },
          };
        }
        if (resource === "/skills/react-hooks/schema") {
          return { status: "SUCCESS", data: { type: "object" } };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    const result = await (
      updateSkill as unknown as (
        client: unknown,
        options: TInstallOptions & { force?: boolean }
      ) => Promise<{ skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean }>
    )(apiClient, {
      skillName: "react-hooks",
      scope: { type: "dir", rootDir },
      force: true,
    });

    expect(result.updated).toBe(true);
    expect(result.toVersion).toBe("2.0.0");

    const skillMd = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
    expect(skillMd).toContain("# refreshed content");
    expect(apiClient.get).toHaveBeenCalledWith("/skills/react-hooks/schema");
  });

  it("throws when skill is not installed", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: {} })),
    };

    await expect(
      (
        updateSkill as unknown as (
          client: unknown,
          options: TInstallOptions & { force?: boolean }
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "missing-skill",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow();

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("propagates API error when manifest fetch fails during update", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "1.0.0" })
    );

    const apiClient = {
      get: mock(async () => ({ status: "ERROR", message: "Registry unavailable" })),
    };

    await expect(
      (
        updateSkill as unknown as (
          client: unknown,
          options: TInstallOptions & { force?: boolean }
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "react-hooks",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow("Registry unavailable");
  });

  it("throws when skill name is invalid and does not call API", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: {} })),
    };

    await expect(
      (
        updateSkill as unknown as (
          client: unknown,
          options: TInstallOptions & { force?: boolean }
        ) => Promise<unknown>
      )(apiClient, {
        skillName: "  ",
        scope: { type: "dir", rootDir },
      })
    ).rejects.toThrow();

    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

describe("updateAllSkills core", () => {
  it("updates all installed skills in scope", async () => {
    const rootDir = await createTempDir();

    const reactHooksDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(reactHooksDir, { recursive: true });
    await writeFile(
      path.join(reactHooksDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "1.0.0" })
    );

    const seoDir = path.join(rootDir, "skills", "seo-writer");
    await mkdir(seoDir, { recursive: true });
    await writeFile(
      path.join(seoDir, "manifest.json"),
      JSON.stringify({ name: "seo-writer", skillVersionId: "3.0.0" })
    );

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_rh",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# v2",
            },
          };
        }
        if (resource === "/skills/react-hooks/schema") {
          return { status: "SUCCESS", data: { type: "object" } };
        }
        if (resource === "/skills/seo-writer") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_seo",
              skillVersionId: "3.0.0",
              name: "seo-writer",
              title: "SEO Writer",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# seo",
            },
          };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    type TUpdateOptions = { scope: TInstallOptions["scope"]; force?: boolean };
    type TUpdateResult = { skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean };

    const results = await (
      updateAllSkills as unknown as (
        client: unknown,
        options: TUpdateOptions
      ) => Promise<TUpdateResult[]>
    )(apiClient, {
      scope: { type: "dir", rootDir },
    });

    expect(results).toHaveLength(2);
    const reactResult = results.find((r) => r.skillName === "react-hooks");
    const seoResult = results.find((r) => r.skillName === "seo-writer");

    expect(reactResult).toMatchObject({ skillName: "react-hooks", fromVersion: "1.0.0", toVersion: "2.0.0", updated: true });
    expect(seoResult).toMatchObject({ skillName: "seo-writer", fromVersion: "3.0.0", toVersion: "3.0.0", updated: false });
  });

  it("returns an empty array when no skills are installed", async () => {
    const rootDir = await createTempDir();
    const apiClient = {
      get: mock(async () => ({ status: "SUCCESS", data: {} })),
    };

    type TUpdateOptions = { scope: TInstallOptions["scope"]; force?: boolean };
    type TUpdateResult = { skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean };

    const results = await (
      updateAllSkills as unknown as (
        client: unknown,
        options: TUpdateOptions
      ) => Promise<TUpdateResult[]>
    )(apiClient, {
      scope: { type: "dir", rootDir },
    });

    expect(results).toEqual([]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("re-installs all skills when --force is set regardless of version match", async () => {
    const rootDir = await createTempDir();
    const skillDir = path.join(rootDir, "skills", "react-hooks");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "manifest.json"),
      JSON.stringify({ name: "react-hooks", skillVersionId: "2.0.0" })
    );
    await writeFile(path.join(skillDir, "SKILL.md"), "# old");

    const apiClient = {
      get: mock(async (resource: string) => {
        if (resource === "/skills/react-hooks") {
          return {
            status: "SUCCESS",
            data: {
              skillId: "skill_123",
              skillVersionId: "2.0.0",
              name: "react-hooks",
              title: "React Hooks",
              description: null,
              author: null,
              sample: { inputs: null, outputs: null },
              inputMetadata: { variables: {}, images: [] },
              skillmd: "# forced refresh",
            },
          };
        }
        if (resource === "/skills/react-hooks/schema") {
          return { status: "SUCCESS", data: { type: "object" } };
        }
        return { status: "ERROR", message: `Unhandled: ${resource}` };
      }),
    };

    type TUpdateOptions = { scope: TInstallOptions["scope"]; force?: boolean };
    type TUpdateResult = { skillName: string; fromVersion: string | undefined; toVersion: string; updated: boolean };

    const results = await (
      updateAllSkills as unknown as (
        client: unknown,
        options: TUpdateOptions
      ) => Promise<TUpdateResult[]>
    )(apiClient, {
      scope: { type: "dir", rootDir },
      force: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].updated).toBe(true);

    const skillMd = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
    expect(skillMd).toContain("# forced refresh");
  });
});
