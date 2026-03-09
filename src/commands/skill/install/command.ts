import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TSkillInstallOptions } from "../../../types/skills";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillInstallCommandOptions } from "./types";

export const createSkillInstallSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.install.name)
    .description(SKILLS_COMMAND.subcommands.install.description)
    .argument(
      SKILLS_COMMAND.subcommands.install.arguments.skillSlug.name,
      SKILLS_COMMAND.subcommands.install.arguments.skillSlug.description
    )
    .option(
      SKILLS_COMMAND.subcommands.install.flags.overwrite.flag,
      SKILLS_COMMAND.subcommands.install.flags.overwrite.description
    )
    .option(
      SKILLS_COMMAND.subcommands.install.flags.json.flag,
      SKILLS_COMMAND.subcommands.install.flags.json.description
    )
    .action(
      async (
        skillName: string,
        opts: TSkillInstallCommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const options: TSkillInstallOptions = {
            scope: ctx.scope,
            ...(opts.overwrite !== undefined && { overwrite: opts.overwrite }),
          };

          const result = await runTaskWithSpinner({
            message: "Installing skill...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.installSkill(skillName, options),
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
