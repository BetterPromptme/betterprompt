import { SKILLS_COMMAND } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TSkillCommandDependencies } from "../types";

export const createSkillInfoSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: SKILLS_COMMAND.subcommands.info.name,
      description: SKILLS_COMMAND.subcommands.info.description,
      arguments: [
        {
          name: SKILLS_COMMAND.subcommands.info.arguments.skillSlug.name,
          description:
            SKILLS_COMMAND.subcommands.info.arguments.skillSlug.description,
        },
      ],
      flags: {
        json: SKILLS_COMMAND.subcommands.info.flags.json,
      },
      spinnerMessage: "Fetching skill details...",
      errorPrefix: SKILL_COMMAND_FAILED_PREFIX,
      handler: async ({ args }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.info.arguments.skillSlug.name
        ] as string;
        return deps.getSkill(skillName);
      },
    },
    factoryDeps
  );
