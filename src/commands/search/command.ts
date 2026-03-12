import logSymbols from "log-symbols";
import { SEARCH_COMMAND, SEARCH_MESSAGES, SKILL_TYPES } from "../../constants";
import { getApiClient } from "../../services/api/client";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { searchSkills, validateSearchQuery } from "../../services/skills/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type {
  TSearchCommandDependencies,
  TSearchCommandOptions,
  TSearchFilters,
} from "./types";

const defaultDeps: TSearchCommandDependencies = {
  validateQuery: validateSearchQuery,
  search: (query, filters) => searchSkills(getApiClient(), query, filters),
};

const buildSearchFilters = (opts: TSearchCommandOptions): TSearchFilters => {
  const filters: TSearchFilters = {};

  if (opts.type !== undefined) {
    if (!(SKILL_TYPES as readonly string[]).includes(opts.type)) {
      throw new Error(
        `Invalid skill type "${opts.type}". Expected one of: ${SKILL_TYPES.join(", ")}.`
      );
    }
    filters.type = opts.type as TSearchFilters["type"];
  }
  if (opts.author !== undefined) {
    filters.author = opts.author;
  }

  return filters;
};

export const createSearchCommand = (
  deps: TSearchCommandDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TSearchCommandOptions>(
    {
      name: SEARCH_COMMAND.name,
      description: SEARCH_COMMAND.description,
      flags: SEARCH_COMMAND.flags,
      arguments: [
        {
          name: SEARCH_COMMAND.arguments.query.name,
          description: SEARCH_COMMAND.arguments.query.description,
        },
      ],
      helpText: SEARCH_MESSAGES.helpText,
      spinnerMessage: "Searching skills...",
      errorPrefix: `${logSymbols.error} ${SEARCH_MESSAGES.failedPrefix}`,
      validate: ({ opts }) => {
        if (
          opts.type !== undefined &&
          !(SKILL_TYPES as readonly string[]).includes(opts.type)
        ) {
          return `Invalid skill type "${opts.type}". Expected one of: ${SKILL_TYPES.join(", ")}.`;
        }
        return undefined;
      },
      handler: async ({ args, opts }) => {
        const query = deps.validateQuery(args[SEARCH_COMMAND.arguments.query.name] as string);
        const filters = buildSearchFilters(opts);
        return deps.search(query, filters);
      },
    },
    factoryDeps
  );

export const searchCommand = createSearchCommand();
