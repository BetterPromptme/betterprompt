import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX, SKILL_EMPTY_LIST_MESSAGE } from "../constants";
import type { TSkillListOptions } from "../../../types/skills";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillListCommandOptions } from "./types";

export const createSkillListSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.list.name)
    .description(SKILLS_COMMAND.subcommands.list.description)
    .option(
      SKILLS_COMMAND.subcommands.list.flags.json.flag,
      SKILLS_COMMAND.subcommands.list.flags.json.description
    )
    .action(async (_opts: TSkillListCommandOptions, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const options: TSkillListOptions = {
          scope: ctx.scope,
        };

        const result = await runTaskWithSpinner({
          message: "Listing installed skills...",
          createSpinner: (message) =>
            ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () => deps.listSkills(options),
        });

        if (result.length === 0 && ctx.outputFormat !== "json") {
          deps.printResult(`${logSymbols.warning} ${SKILL_EMPTY_LIST_MESSAGE}`, ctx);
          return;
        }

        deps.printResult(result, ctx);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        deps.error(
          `${logSymbols.error} ${SKILL_COMMAND_FAILED_PREFIX} ${errorMessage}`
        );
        deps.setExitCode(1);
      }
    });
