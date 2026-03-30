import logSymbols from "log-symbols";

import {
  SKILLS_COMMAND,
  SKILLS_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { track } from "../../../services/telemetry/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TInstallSkillResult } from "../../../types/installer";
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
        agent: SKILLS_COMMAND.subcommands.install.flags.agent,
        overwrite: SKILLS_COMMAND.subcommands.install.flags.overwrite,
        json: SKILLS_COMMAND.subcommands.install.flags.json,
      },
      spinnerMessage: "Installing skill...",
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      validate: ({ opts }) => {
        const agents = opts.agent as string[] | undefined;
        if (!agents || agents.length === 0)
          return SKILLS_MESSAGES.agentRequiredForInstallError;
        return undefined;
      },
      formatText: (result) => {
        const r = result as TInstallSkillResult;
        return `${logSymbols.success} Installed "${r.skillName}"`;
      },
      handler: async ({ args, opts, ctx }) => {
        const start = performance.now();
        const skillName = args[
          SKILLS_COMMAND.subcommands.install.arguments.skillSlug.name
        ] as string;
        const options = {
          scope: ctx.scope,
          ...(opts.overwrite !== undefined && {
            overwrite: opts.overwrite as boolean,
          }),
          agents: opts.agent as string[],
        };
        const result = await deps.installSkill(skillName, options);
        void track({
          command: TELEMETRY_COMMANDS["skill:install"],
          startedAt: start,
          metadata: { skillSlug: skillName },
        });
        return result;
      },
    },
    factoryDeps
  );
