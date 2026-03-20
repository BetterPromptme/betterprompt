import logSymbols from "log-symbols";

import {
  SKILLS_COMMAND,
  SKILLS_MESSAGES,
  TELEMETRY_EVENTS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { track } from "../../../services/telemetry/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TUninstallSkillResult } from "../../../types/installer";
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
            SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug
              .description,
        },
      ],
      flags: {
        agent: SKILLS_COMMAND.subcommands.uninstall.flags.agent,
        json: SKILLS_COMMAND.subcommands.uninstall.flags.json,
      },
      spinnerMessage: "Uninstalling skill...",
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      formatText: (result) => {
        const r = result as TUninstallSkillResult;
        const agents = r.removedAgents.length
          ? r.removedAgents.join(", ")
          : "no agents";
        return `${logSymbols.success} Uninstalled "${r.skillName}" from ${agents}`;
      },
      validate: ({ opts }) => {
        if (!opts.agent) return SKILLS_MESSAGES.agentRequiredForUninstallError;
        return undefined;
      },
      handler: async ({ args, opts, ctx }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.name
        ] as string;
        const result = await deps.uninstallSkill(skillName, {
          scope: ctx.scope,
          agent: opts.agent as string,
        });
        void track({
          event: TELEMETRY_EVENTS.skillUninstall,
          skillSlug: skillName,
        });
        return result;
      },
    },
    factoryDeps
  );
