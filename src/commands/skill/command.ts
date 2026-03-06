import { Command } from "commander";
import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../../constants";
import { createDefaultSkillCommandDependencies } from "../../services/skills/service";
import { createSkillInfoSubcommand } from "./info/command";
import { createSkillInstallSubcommand } from "./install/command";
import { createSkillListSubcommand } from "./list/command";
import { createSkillSearchSubcommand } from "./search/command";
import { createSkillUninstallSubcommand } from "./uninstall/command";
import { createSkillUpdateSubcommand } from "./update/command";
import type { TSkillCommandDependencies } from "./types";

export const createSkillCommand = (
  deps: TSkillCommandDependencies = createDefaultSkillCommandDependencies()
): Command => {
  const command = new Command(SKILLS_COMMAND.name)
    .description(SKILLS_COMMAND.description)
    .addHelpText("after", SKILLS_MESSAGES.helpText);

  command.addCommand(createSkillInfoSubcommand(deps));
  command.addCommand(createSkillInstallSubcommand(deps));
  command.addCommand(createSkillUninstallSubcommand(deps));
  command.addCommand(createSkillListSubcommand(deps));
  command.addCommand(createSkillUpdateSubcommand(deps));
  command.addCommand(createSkillSearchSubcommand(deps));

  return command;
};

export const skillCommand = createSkillCommand();
