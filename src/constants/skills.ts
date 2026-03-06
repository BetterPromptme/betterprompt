import { SHARED_FLAGS } from "./flags";
import { SKILL_TYPES } from "./search";

const SKILL_NAME_ARGUMENT = {
  name: "<skill-slug>",
  description: "Skill name to retrieve",
} as const;

const SKILL_NAME_INSTALL_ARGUMENT = {
  name: "<skill-slug>",
  description: "Skill name to install",
} as const;

const SKILL_NAME_UNINSTALL_ARGUMENT = {
  name: "<skill-slug>",
  description: "Skill name to uninstall",
} as const;

const SKILL_NAME_UPDATE_ARGUMENT = {
  name: "[skill-slug]",
  description: "Skill name to update",
} as const;

export const SKILLS_COMMAND = {
  name: "skill",
  description: "Manage BetterPrompt skills",
  subcommands: {
    info: {
      name: "info",
      description: "Get details of a skill by name",
      arguments: {
        skillSlug: SKILL_NAME_ARGUMENT,
      },
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
    install: {
      name: "install",
      description: "Install a skill by name",
      arguments: {
        skillSlug: SKILL_NAME_INSTALL_ARGUMENT,
      },
      flags: {
        overwrite: {
          flag: "--overwrite",
          description: "Overwrite an existing installed skill",
        },
        json: SHARED_FLAGS.json,
      },
    },
    uninstall: {
      name: "uninstall",
      description: "Uninstall an installed skill by name",
      arguments: {
        skillSlug: SKILL_NAME_UNINSTALL_ARGUMENT,
      },
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
    list: {
      name: "list",
      description: "List all installed skills",
      arguments: {},
      flags: {
        json: SHARED_FLAGS.json,
      },
    },
    update: {
      name: "update",
      description: "Update an installed skill to the latest version",
      arguments: {
        skillSlug: SKILL_NAME_UPDATE_ARGUMENT,
      },
      flags: {
        force: {
          flag: "--force",
          description: "Re-install even if already at latest version",
        },
        all: {
          flag: "--all",
          description: "Update all installed skills in scope",
        },
        json: SHARED_FLAGS.json,
      },
    },
    search: {
      name: "search",
      description: "Search BetterPrompt skills",
      arguments: {
        query: {
          name: "<query>",
          description: "Search query (minimum 3 characters)",
        },
      },
      flags: {
        type: {
          flag: "--type <type>",
          description: `Filter by skill type (${SKILL_TYPES.join(", ")})`,
        },
        author: {
          flag: "--author <author>",
          description: "Filter by author",
        },
        json: SHARED_FLAGS.json,
      },
    },
  },
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
  updateRequiresSkillNameOrAllError:
    'Please provide a skill name or pass "--all" to update all installed skills.',
  updateAllWithSkillNameError:
    'Cannot use "--all" together with a specific skill name.',
  failedPrefix: "Skill command failed:",
} as const;
