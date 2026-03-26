import logSymbols from "log-symbols";

import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TSkillCommandDependencies } from "../types";

export const createSkillListSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: SKILLS_COMMAND.subcommands.list.name,
      description: SKILLS_COMMAND.subcommands.list.description,
      flags: {
        json: SKILLS_COMMAND.subcommands.list.flags.json,
      },
      spinnerMessage: "Listing installed skills...",
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      formatText: (result) => {
        const skills = result as Array<{
          name: string;
          title?: string;
          installedAgents?: string[];
        }>;
        if (skills.length === 0) {
          return `${logSymbols.warning} ${SKILLS_MESSAGES.emptyListMessage}`;
        }
        const rows = skills.map((s) => {
          const agents = s.installedAgents?.length
            ? s.installedAgents.join(", ")
            : "(none)";
          return `  ${s.name.padEnd(30)} ${agents}`;
        });
        return [
          "  Slug                           Installed Agents",
          ...rows,
        ].join("\n");
      },
      handler: async ({ ctx }) => {
        return deps.listSkills({ scope: ctx.scope });
      },
    },
    factoryDeps
  );
