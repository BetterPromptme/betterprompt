import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TSkillCommandDependencies } from "../types";

export const createSkillUninstallSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: SKILLS_COMMAND.subcommands.uninstall.name,
      description: SKILLS_COMMAND.subcommands.uninstall.description,
      arguments: [
        {
          name: SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.name,
          description:
            SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.description,
        },
      ],
      flags: {
        json: SKILLS_COMMAND.subcommands.uninstall.flags.json,
      },
      spinnerMessage: "Uninstalling skill...",
      errorPrefix: SKILLS_MESSAGES.failedPrefix,
      handler: async ({ args, ctx }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.name
        ] as string;
        return deps.uninstallSkill(skillName, { scope: ctx.scope });
      },
    },
    factoryDeps
  );
