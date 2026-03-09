import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TSkillUninstallOptions } from "../../../types/skills";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillUninstallCommandOptions } from "./types";

export const createSkillUninstallSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.uninstall.name)
    .description(SKILLS_COMMAND.subcommands.uninstall.description)
    .argument(
      SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.name,
      SKILLS_COMMAND.subcommands.uninstall.arguments.skillSlug.description
    )
    .option(
      SKILLS_COMMAND.subcommands.uninstall.flags.json.flag,
      SKILLS_COMMAND.subcommands.uninstall.flags.json.description
    )
    .action(
      async (
        skillName: string,
        _opts: TSkillUninstallCommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const options: TSkillUninstallOptions = {
            scope: ctx.scope,
          };

          const result = await runTaskWithSpinner({
            message: "Uninstalling skill...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.uninstallSkill(skillName, options),
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
