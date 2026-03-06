import { describe, expect, it } from "bun:test";

type TValidateSkillName = (input: string) => string;

const loadValidateSkillName = async (): Promise<TValidateSkillName> => {
  const skillNameModulePath = "./skill-name";
  const skillNameModule: unknown = await import(skillNameModulePath);

  if (
    typeof skillNameModule !== "object" ||
    skillNameModule === null ||
    !("validateSkillName" in skillNameModule)
  ) {
    throw new Error("validateSkillName export was not found in src/services/skills/skill-name.ts");
  }

  const validateSkillName = (skillNameModule as { validateSkillName: unknown })
    .validateSkillName;

  if (typeof validateSkillName !== "function") {
    throw new Error("validateSkillName must be a function");
  }

  return validateSkillName as TValidateSkillName;
};

describe("validateSkillName", () => {
  it("returns a valid skill name as-is", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(validateSkillName("seo-blog-writer")).toBe("seo-blog-writer");
  });

  it("throws for an empty string", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(() => validateSkillName("")).toThrow();
  });

  it("throws for whitespace-only input", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(() => validateSkillName("   \n\t  ")).toThrow();
  });

  it("trims leading and trailing whitespace", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(validateSkillName("  humanize-ai-text  ")).toBe("humanize-ai-text");
  });

  it("accepts names with numbers", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(validateSkillName("humanize-ai-text-2")).toBe("humanize-ai-text-2");
  });

  it("rejects names with special characters", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(() => validateSkillName("humanize@ai")).toThrow();
    expect(() => validateSkillName("seo/blog-writer")).toThrow();
    expect(() => validateSkillName("writer!")).toThrow();
  });

  it("rejects uppercase letters", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(() => validateSkillName("SEO-blog-writer")).toThrow();
  });

  it("rejects malformed hyphen placement", async () => {
    const validateSkillName = await loadValidateSkillName();

    expect(() => validateSkillName("-writer")).toThrow();
    expect(() => validateSkillName("writer-")).toThrow();
    expect(() => validateSkillName("writer--assistant")).toThrow();
  });
});
