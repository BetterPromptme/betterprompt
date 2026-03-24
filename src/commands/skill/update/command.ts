import logSymbols from "log-symbols";

import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { runTaskWithSpinner } from "../../../services/error-ux/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type { TUpdateSkillResult } from "../../../types/installer";
import type { TSkillCommandDependencies } from "../types";
import type { TSkillUpdateCommandOptions } from "./types";

const formatUpdateResult = (result: TUpdateSkillResult): string => {
  if (!result.updated) {
    return `${logSymbols.success} ${result.skillName} — up to date`;
  }
  const sha =
    result.from && result.to ? ` (${result.from} → ${result.to})` : "";
  return `${logSymbols.success} ${result.skillName} — updated${sha}`;
};

const formatUpdateResults = (
  results: TUpdateSkillResult | TUpdateSkillResult[]
): string => {
  if (Array.isArray(results)) {
    return results.map(formatUpdateResult).join("\n");
  }
  return formatUpdateResult(results);
};

export const createSkillUpdateSubcommand = (
  deps: TSkillCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TSkillUpdateCommandOptions>(
    {
      name: SKILLS_COMMAND.subcommands.update.name,
      description: SKILLS_COMMAND.subcommands.update.description,
      arguments: [
        {
          name: SKILLS_COMMAND.subcommands.update.arguments.skillSlug.name,
          description:
            SKILLS_COMMAND.subcommands.update.arguments.skillSlug.description,
        },
      ],
      flags: {
        force: SKILLS_COMMAND.subcommands.update.flags.force,
        all: SKILLS_COMMAND.subcommands.update.flags.all,
        json: SKILLS_COMMAND.subcommands.update.flags.json,
      },
      errorPrefix: `${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix}`,
      formatText: (result) =>
        formatUpdateResults(
          result as TUpdateSkillResult | TUpdateSkillResult[]
        ),
      validate: ({ opts, args }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.update.arguments.skillSlug.name
        ] as string | undefined;
        if (skillName !== undefined && opts.all === true) {
          return SKILLS_MESSAGES.updateAllWithSkillNameError;
        }
        if (skillName === undefined && opts.all !== true) {
          return SKILLS_MESSAGES.updateRequiresSkillNameOrAllError;
        }
        return undefined;
      },
      handler: async ({ opts, args, ctx, deps: handlerDeps }) => {
        const skillName = args[
          SKILLS_COMMAND.subcommands.update.arguments.skillSlug.name
        ] as string | undefined;
        const options = {
          scope: ctx.scope,
          ...(opts.force !== undefined && { force: opts.force }),
        };

        // Two distinct spinner messages depending on --all, so the factory's
        // single spinnerMessage field isn't used; we drive the spinner manually.
        if (skillName !== undefined) {
          return runTaskWithSpinner({
            message: "Updating skill...",
            createSpinner: handlerDeps.createSpinner,
            task: () => deps.updateSkill(skillName, options),
          });
        }

        return runTaskWithSpinner({
          message: "Updating all skills...",
          createSpinner: handlerDeps.createSpinner,
          task: () => deps.updateAllSkills(options),
        });
      },
    },
    factoryDeps
  );
