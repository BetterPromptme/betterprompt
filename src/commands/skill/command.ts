import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../constants";
import { createParentCommandFromSpec } from "../../services/command-factory/service";
import { createDefaultSkillCommandDependencies } from "../../services/skills/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createSkillInfoSubcommand } from "./info/command";
import { createSkillInstallSubcommand } from "./install/command";
import { createSkillListSubcommand } from "./list/command";
import { createSkillSearchSubcommand } from "./search/command";
import type { TSkillCommandDependencies } from "./types";
import { createSkillUninstallSubcommand } from "./uninstall/command";
import { createSkillUpdateSubcommand } from "./update/command";

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
        createSkillInfoSubcommand(deps, factoryDeps),
        createSkillInstallSubcommand(deps, factoryDeps),
        createSkillUninstallSubcommand(deps, factoryDeps),
        createSkillListSubcommand(deps, factoryDeps),
        createSkillUpdateSubcommand(deps, factoryDeps),
        createSkillSearchSubcommand(deps, factoryDeps),
      ],
    },
    factoryDeps
  );

export const skillCommand = createSkillCommand();
