import logSymbols from "log-symbols";

import {
  SKILLS_COMMAND,
  SKILLS_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { track } from "../../../services/telemetry/service";
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
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      handler: async ({ args }) => {
        const start = performance.now();
        const skillName = args[
          SKILLS_COMMAND.subcommands.info.arguments.skillSlug.name
        ] as string;
        const result = await deps.getSkill(skillName);
        void track({
          command: TELEMETRY_COMMANDS["skill:info"],
          startedAt: start,
          metadata: { skillSlug: skillName },
        });
        return result;
      },
    },
    factoryDeps
  );
