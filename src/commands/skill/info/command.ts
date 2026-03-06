import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { SKILLS_COMMAND } from "../../../constants";
import { getCommandContext } from "../../../services/context/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import { SKILL_COMMAND_FAILED_PREFIX } from "../constants";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillInfoSubcommandOptions } from "./types";

export const createSkillInfoSubcommand = (
  deps: TSkillCommandDependencies
): Command =>
  new Command(SKILLS_COMMAND.subcommands.info.name)
    .description(SKILLS_COMMAND.subcommands.info.description)
    .argument(
      SKILLS_COMMAND.subcommands.info.arguments.skillSlug.name,
      SKILLS_COMMAND.subcommands.info.arguments.skillSlug.description
    )
    .option(
      SKILLS_COMMAND.subcommands.info.flags.json.flag,
      SKILLS_COMMAND.subcommands.info.flags.json.description
    )
    .action(
      async (
        skillName: string,
        _opts: TSkillInfoSubcommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const result = await runTaskWithSpinner({
            message: "Fetching skill details...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.getSkill(skillName),
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
