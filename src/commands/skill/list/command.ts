import logSymbols from "log-symbols";
import { SKILLS_COMMAND } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { SKILL_COMMAND_FAILED_PREFIX, SKILL_EMPTY_LIST_MESSAGE } from "../constants";
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
      errorPrefix: SKILL_COMMAND_FAILED_PREFIX,
      formatText: (result) => {
        const skills = result as Array<unknown>;
        if (skills.length === 0) {
          return `${logSymbols.warning} ${SKILL_EMPTY_LIST_MESSAGE}`;
        }
        return result;
      },
      handler: async ({ ctx }) => {
        return deps.listSkills({ scope: ctx.scope });
      },
    },
    factoryDeps
  );
