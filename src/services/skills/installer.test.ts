import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installSkill, listSkills, uninstallSkill, updateAllSkills, updateSkill } from "./installer";

describe("services/skills/installer", () => {
  it("exports installer operations from services/skills", () => {
    expect(typeof installSkill).toBe("function");
    expect(typeof uninstallSkill).toBe("function");
    expect(typeof listSkills).toBe("function");
    expect(typeof updateSkill).toBe("function");
    expect(typeof updateAllSkills).toBe("function");
  });

  it("listSkills resolves a dir scope and returns empty list when no skills are installed", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "betterprompt-services-installer-"));

    try {
      await mkdir(path.join(rootDir, "skills"), { recursive: true });

      const result = await listSkills({
        scope: {
          type: "dir",
          path: rootDir,
        },
      });

      expect(result).toEqual([]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("installSkill validates name before remote calls", async () => {
    await expect(
      installSkill("   ", {
        scope: {
          type: "global",
        },
      })
    ).rejects.toThrow("Skill name cannot be empty");
  });
});
