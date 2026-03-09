import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SEARCH_COMMAND, SEARCH_MESSAGES, SKILL_TYPES } from "../../constants";
import { getApiClient } from "../../services/api/client";
import { getCommandContext } from "../../services/context/service";
import { runTaskWithSpinner } from "../../services/error-ux/service";
import { printResult } from "../../services/output/service";
import { searchSkills, validateSearchQuery } from "../../services/skills/service";
import type {
  TSearchCommandDependencies,
  TSearchCommandOptions,
  TSearchFilters,
} from "./types";

const defaultDeps: TSearchCommandDependencies = {
  validateQuery: validateSearchQuery,
  search: (query, filters) => searchSkills(getApiClient(), query, filters),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
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

export const addSearchFilterOptions = (command: Command): Command =>
  command
    .option(SEARCH_COMMAND.flags.type.flag, SEARCH_COMMAND.flags.type.description)
    .option(SEARCH_COMMAND.flags.author.flag, SEARCH_COMMAND.flags.author.description)
    .option(SEARCH_COMMAND.flags.json.flag, SEARCH_COMMAND.flags.json.description);

export const createSearchCommand = (
  deps: TSearchCommandDependencies = defaultDeps
): Command => {
  const command = addSearchFilterOptions(
    new Command(SEARCH_COMMAND.name)
  )
    .description(SEARCH_COMMAND.description)
    .addHelpText("after", SEARCH_MESSAGES.helpText);

  command
    .argument(
      SEARCH_COMMAND.arguments.query.name,
      SEARCH_COMMAND.arguments.query.description
    )
    .action(async (query: string, opts: TSearchCommandOptions, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const normalizedQuery = deps.validateQuery(query);
        const filters = buildSearchFilters(opts);
        const result = await runTaskWithSpinner({
          message: "Searching skills...",
          createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () => deps.search(normalizedQuery, filters),
        });
        deps.printResult(result, ctx);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${SEARCH_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

  return command;
};

export const searchCommand = createSearchCommand();
