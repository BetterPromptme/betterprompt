import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TSkillCommandDependencies } from "../types";

export const createSkillInstallSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: SKILLS_COMMAND.subcommands.install.name,
      description: SKILLS_COMMAND.subcommands.install.description,
      arguments: [
        {
          name: SKILLS_COMMAND.subcommands.install.arguments.skillSlug.name,
          description:
            SKILLS_COMMAND.subcommands.install.arguments.skillSlug.description,
        },
      ],
      flags: {
        overwrite: SKILLS_COMMAND.subcommands.install.flags.overwrite,
        json: SKILLS_COMMAND.subcommands.install.flags.json,
      },
      spinnerMessage: "Installing skill...",
      errorPrefix: SKILLS_MESSAGES.failedPrefix,
      handler: async ({ args, opts, ctx }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.install.arguments.skillSlug.name
        ] as string;
        const options = {
          scope: ctx.scope,
          ...(opts.overwrite !== undefined && {
            overwrite: opts.overwrite as boolean,
          }),
        };
        return deps.installSkill(skillName, options);
      },
    },
    factoryDeps
  );
