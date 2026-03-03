import { Command } from "commander";
import { SEARCH_COMMAND, SEARCH_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import { searchSkills, validateSearchQuery } from "../core/skills";

type TSearchCommandDependencies = {
  validateQuery: (query: string) => string;
  search: (query: string) => Promise<unknown>;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TSearchCommandDependencies = {
  validateQuery: validateSearchQuery,
  search: (query) => searchSkills(getApiClient(), query),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createSearchCommand = (
  deps: TSearchCommandDependencies = defaultDeps
): Command => {
  const command = new Command(SEARCH_COMMAND.name)
    .description(SEARCH_COMMAND.description)
    .addHelpText("after", SEARCH_MESSAGES.helpText);

  command.argument("<query>", SEARCH_COMMAND.queryDescription).action(async (query) => {
    try {
      const normalizedQuery = deps.validateQuery(query);
      const result = await deps.search(normalizedQuery);
      deps.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      deps.error(`${SEARCH_MESSAGES.failedPrefix} ${errorMessage}`);
      deps.setExitCode(1);
    }
  });

  return command;
};

export const searchCommand = createSearchCommand();
