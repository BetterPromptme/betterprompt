import type { TValidateSkillName } from "../types/skill-name";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const validateSkillName: TValidateSkillName = (input) => {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    throw new Error("Skill name cannot be empty.");
  }

  if (!SKILL_NAME_PATTERN.test(normalizedInput)) {
    throw new Error(
      "Skill name is invalid. Use lowercase letters, numbers, and single hyphens."
    );
  }

  return normalizedInput;
};
