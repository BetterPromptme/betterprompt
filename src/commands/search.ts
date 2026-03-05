import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SEARCH_COMMAND, SEARCH_MESSAGES, SKILL_TYPES } from "../constants";
import { getApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import { searchSkills, validateSearchQuery } from "../core/skills";
import type {
  TSearchCommandDependencies,
  TSearchCommandOptions,
  TSearchFilters,
} from "../types/search";

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
    .option(
      "--type <type>",
      `Filter by skill type (${SKILL_TYPES.join(", ")})`
    )
    .option("--author <author>", "Filter by author")
    .option("--json", "Render output as JSON");

export const createSearchCommand = (
  deps: TSearchCommandDependencies = defaultDeps
): Command => {
  const command = addSearchFilterOptions(
    new Command(SEARCH_COMMAND.name)
  )
    .description(SEARCH_COMMAND.description)
    .addHelpText("after", SEARCH_MESSAGES.helpText);

  command
    .argument("<query>", SEARCH_COMMAND.queryDescription)
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
