import { Command } from "commander";
import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import { getSkillById } from "../core/skills";

type TSkillsCommandDependencies = {
  getSkill: (skillId: string) => Promise<unknown>;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TSkillsCommandDependencies = {
  getSkill: (skillId) => getSkillById(getApiClient(), skillId),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createSkillsCommand = (
  deps: TSkillsCommandDependencies = defaultDeps
): Command => {
  const command = new Command(SKILLS_COMMAND.name)
    .description(SKILLS_COMMAND.description)
    .addHelpText("after", SKILLS_MESSAGES.helpText);

  const infoCommand = new Command(SKILLS_COMMAND.info.name)
    .description(SKILLS_COMMAND.info.description)
    .argument("<skillId>", SKILLS_COMMAND.info.skillIdDescription)
    .action(async (skillId: string) => {
      try {
        const result = await deps.getSkill(skillId);
        deps.log(JSON.stringify(result, null, 2));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

  command.addCommand(infoCommand);

  return command;
};

export const skillsCommand = createSkillsCommand();
