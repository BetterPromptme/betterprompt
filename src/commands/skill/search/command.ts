import logSymbols from "log-symbols";

import {
  SKILL_TYPES,
  SKILLS_COMMAND,
  SKILLS_MESSAGES,
} from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TSearchFilters } from "../../../types/search";
import type { TSkillCommandDependencies } from "../types";

const buildSearchFilters = (opts: Record<string, unknown>): TSearchFilters => {
  const filters: TSearchFilters = {};

  if (opts.type !== undefined) {
    const type = opts.type as string;
    if (!(SKILL_TYPES as readonly string[]).includes(type)) {
      throw new Error(
        `Invalid skill type "${type}". Expected one of: ${SKILL_TYPES.join(", ")}.`
      );
    }
    filters.type = type as TSearchFilters["type"];
  }

  if (opts.author !== undefined) {
    filters.author = opts.author as string;
  }

  return filters;
};

export const createSkillSearchSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: SKILLS_COMMAND.subcommands.search.name,
      description: SKILLS_COMMAND.subcommands.search.description,
      arguments: [
        {
          name: SKILLS_COMMAND.subcommands.search.arguments.query.name,
          description:
            SKILLS_COMMAND.subcommands.search.arguments.query.description,
        },
      ],
      flags: {
        type: SKILLS_COMMAND.subcommands.search.flags.type,
        author: SKILLS_COMMAND.subcommands.search.flags.author,
        json: SKILLS_COMMAND.subcommands.search.flags.json,
      },
      spinnerMessage: "Searching skills...",
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      handler: async ({ args, opts }) => {
        const query = args[
          SKILLS_COMMAND.subcommands.search.arguments.query.name
        ] as string;
        const normalizedQuery = deps.validateQuery(query);
        const filters = buildSearchFilters(opts);
        return deps.search(normalizedQuery, filters);
      },
    },
    factoryDeps
  );
