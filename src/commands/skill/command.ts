import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../constants";
import { createDefaultSkillCommandDependencies } from "../../services/skills/service";
import { createParentCommandFromSpec } from "../../services/command-factory/service";
import { createSkillInfoSubcommand } from "./info/command";
import { createSkillInstallSubcommand } from "./install/command";
import { createSkillListSubcommand } from "./list/command";
import { createSkillSearchSubcommand } from "./search/command";
import { createSkillUninstallSubcommand } from "./uninstall/command";
import { createSkillUpdateSubcommand } from "./update/command";
import type { TSkillCommandDependencies } from "./types";
import type { TCommandFactoryDeps } from "../../types/command-factory";

export const createSkillCommand = (
  deps: TSkillCommandDependencies = createDefaultSkillCommandDependencies(),
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createParentCommandFromSpec(
    {
      name: SKILLS_COMMAND.name,
      description: SKILLS_COMMAND.description,
      helpText: SKILLS_MESSAGES.helpText,
      subcommands: [
        createSkillInfoSubcommand(deps),
        createSkillInstallSubcommand(deps),
        createSkillUninstallSubcommand(deps),
        createSkillListSubcommand(deps),
        createSkillUpdateSubcommand(deps),
        createSkillSearchSubcommand(deps),
      ],
    },
    factoryDeps
  );

export const skillCommand = createSkillCommand();
