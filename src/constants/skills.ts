export const SKILLS_COMMAND = {
  name: "skills",
  description: "Manage BetterPrompt skills",
  info: {
    name: "info",
    description: "Get details of a skill by ID",
    skillIdDescription: "Skill ID to retrieve",
  },
} as const;

export const SKILLS_MESSAGES = {
  helpText: `
Examples:
  $ betterprompt skills info <skillId>
`,
  invalidSkillIdError: "Skill ID must not be empty.",
  failedPrefix: "Skills command failed:",
} as const;
