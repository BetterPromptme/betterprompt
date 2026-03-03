export const SKILLS_COMMAND = {
  name: "skill",
  description: "Manage BetterPrompt skills",
  info: {
    name: "info",
    description: "Get details of a skill by name",
    skillNameDescription: "Skill name to retrieve",
  },
  install: {
    name: "install",
    description: "Install a skill by name",
    skillNameDescription: "Skill name to install",
    flags: {
      pin: {
        description: "Pin installed version in betterprompt.lock",
      },
      overwrite: {
        description: "Overwrite an existing installed skill",
      },
    },
  },
  uninstall: {
    name: "uninstall",
    description: "Uninstall an installed skill by name",
    skillNameDescription: "Skill name to uninstall",
  },
  list: {
    name: "list",
    description: "List all installed skills",
  },
  update: {
    name: "update",
    description: "Update an installed skill to the latest version",
    skillNameDescription: "Skill name to update",
    flags: {
      force: {
        description: "Re-install even if already at latest version",
      },
      all: {
        description: "Update all installed skills in scope",
      },
    },
  },
} as const;

export const SKILLS_MESSAGES = {
  helpText: `
Examples:
  $ betterprompt skill info <skill-name>
  $ betterprompt skill install <skill-name>
  $ betterprompt skill uninstall <skill-name>
  $ betterprompt skill list
  $ betterprompt skill update <skill-name>
  $ betterprompt skill update --all
`,
  invalidSkillNameError: "Skill name must not be empty.",
  failedPrefix: "Skill command failed:",
} as const;
