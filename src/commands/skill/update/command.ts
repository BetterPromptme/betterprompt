import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TSkillUpdateOptions } from "../../../types/skills";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillUpdateCommandOptions } from "./types";

export const createSkillUpdateSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.update.name)
    .description(SKILLS_COMMAND.subcommands.update.description)
    .argument(
      SKILLS_COMMAND.subcommands.update.arguments.skillSlug.name,
      SKILLS_COMMAND.subcommands.update.arguments.skillSlug.description
    )
    .option(
      SKILLS_COMMAND.subcommands.update.flags.force.flag,
      SKILLS_COMMAND.subcommands.update.flags.force.description
    )
    .option(
      SKILLS_COMMAND.subcommands.update.flags.all.flag,
      SKILLS_COMMAND.subcommands.update.flags.all.description
    )
    .option(
      SKILLS_COMMAND.subcommands.update.flags.json.flag,
      SKILLS_COMMAND.subcommands.update.flags.json.description
    )
    .action(
      async (
        skillName: string | undefined,
        opts: TSkillUpdateCommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const options: TSkillUpdateOptions = {
            scope: ctx.scope,
            ...(opts.force !== undefined && { force: opts.force }),
          };

          if (skillName !== undefined && opts.all === true) {
            throw new Error(SKILLS_MESSAGES.updateAllWithSkillNameError);
          }

          if (skillName === undefined && opts.all !== true) {
            throw new Error(SKILLS_MESSAGES.updateRequiresSkillNameOrAllError);
          }

          if (skillName !== undefined) {
            const result = await runTaskWithSpinner({
              message: "Updating skill...",
              createSpinner: (message) =>
                ora({ text: message, isEnabled: process.stderr.isTTY }),
              task: () => deps.updateSkill(skillName, options),
            });
            deps.printResult(result, ctx);
            return;
          }

          const results = await runTaskWithSpinner({
            message: "Updating all skills...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.updateAllSkills(options),
          });
          deps.printResult(results, ctx);
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
