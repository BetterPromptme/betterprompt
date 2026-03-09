import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND, SKILL_TYPES } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TSearchFilters } from "../../../types/search";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillSearchSubcommandOptions } from "./types";

const buildSearchFilters = (
  opts: TSkillSearchSubcommandOptions
): TSearchFilters => {
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

export const createSkillSearchSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.search.name)
    .description(SKILLS_COMMAND.subcommands.search.description)
    .argument(
      SKILLS_COMMAND.subcommands.search.arguments.query.name,
      SKILLS_COMMAND.subcommands.search.arguments.query.description
    )
    .option(
      SKILLS_COMMAND.subcommands.search.flags.type.flag,
      SKILLS_COMMAND.subcommands.search.flags.type.description
    )
    .option(
      SKILLS_COMMAND.subcommands.search.flags.author.flag,
      SKILLS_COMMAND.subcommands.search.flags.author.description
    )
    .option(
      SKILLS_COMMAND.subcommands.search.flags.json.flag,
      SKILLS_COMMAND.subcommands.search.flags.json.description
    )
    .action(
      async (
        query: string,
        opts: TSkillSearchSubcommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const normalizedQuery = deps.validateQuery(query);
          const filters = buildSearchFilters(opts);
          const result = await runTaskWithSpinner({
            message: "Searching skills...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.search(normalizedQuery, filters),
          });
          deps.printResult(result, ctx);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          deps.error(
            `${logSymbols.error} ${SKILL_COMMAND_FAILED_PREFIX} ${errorMessage}`
          );
          deps.setExitCode(1);
        }
      }
    );
