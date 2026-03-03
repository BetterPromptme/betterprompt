import { Command } from "commander";
import logSymbols from "log-symbols";
import { SKILLS_COMMAND, SKILLS_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import { printResult } from "../core/output";
import { resolveScope } from "../core/scope";
import {
  installSkill as installSkillCore,
  listSkills as listSkillsCore,
  uninstallSkill as uninstallSkillCore,
  updateSkill as updateSkillCore,
  updateAllSkills as updateAllSkillsCore,
} from "../core/installer";
import { getSkillByName, searchSkills, validateSearchQuery } from "../core/skills";
import { createSearchCommand } from "./search";
import type { TSearchFilters } from "../types/search";
import type { TInstallSkillOptions } from "../types/installer";
import type { TPrintOptions } from "../types";
import type {
  TSkillInstallCommandOptions,
  TSkillInstallOptions,
  TSkillListCommandOptions,
  TSkillListOptions,
  TSkillUninstallCommandOptions,
  TSkillUninstallOptions,
  TSkillUpdateCommandOptions,
  TSkillUpdateOptions,
} from "../types/skills";
import type { TUpdateSkillResult } from "../types/installer";
import type { TSkillSummary } from "../types/installer";

type TSkillsCommandDependencies = {
  getSkill: (skillId: string) => Promise<unknown>;
  installSkill: (skillName: string, options: TSkillInstallOptions) => Promise<unknown>;
  uninstallSkill: (
    skillName: string,
    options: TSkillUninstallOptions
  ) => Promise<unknown>;
  listSkills: (options: TSkillListOptions) => Promise<TSkillSummary[]>;
  updateSkill: (skillName: string, options: TSkillUpdateOptions) => Promise<TUpdateSkillResult>;
  updateAllSkills: (options: TSkillUpdateOptions) => Promise<TUpdateSkillResult[]>;
  validateQuery: (query: string) => string;
  search: (query: string, filters: TSearchFilters) => Promise<unknown>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TSkillsCommandDependencies = {
  getSkill: (skillName) => getSkillByName(getApiClient(), skillName),
  installSkill: async (skillName, options) => {
    const scopeContext = {
      scope: options.scope,
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    } as const;
    const resolvedScope = await resolveScope(scopeContext);
    const installOptions: TInstallSkillOptions = {
      skillName,
      scope: resolvedScope,
      pin: options.pin,
      overwrite: options.overwrite,
    };

    return installSkillCore(getApiClient(), installOptions);
  },
  uninstallSkill: async (skillName, options) => {
    const scopeContext = {
      scope: options.scope,
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    } as const;
    const resolvedScope = await resolveScope(scopeContext);

    return uninstallSkillCore({
      skillName,
      scope: resolvedScope,
    });
  },
  listSkills: async (options) => {
    const scopeContext = {
      scope: options.scope,
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    } as const;
    const resolvedScope = await resolveScope(scopeContext);

    return listSkillsCore({ scope: resolvedScope });
  },
  updateSkill: async (skillName, options) => {
    const scopeContext = {
      scope: options.scope,
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    } as const;
    const resolvedScope = await resolveScope(scopeContext);

    return updateSkillCore(getApiClient(), {
      skillName,
      scope: resolvedScope,
      force: options.force,
    });
  },
  updateAllSkills: async (options) => {
    const scopeContext = {
      scope: options.scope,
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    } as const;
    const resolvedScope = await resolveScope(scopeContext);

    return updateAllSkillsCore(getApiClient(), {
      scope: resolvedScope,
      force: options.force,
    });
  },
  validateQuery: validateSearchQuery,
  search: (query, filters) => searchSkills(getApiClient(), query, filters),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createSkillCommand = (
  deps: TSkillsCommandDependencies = defaultDeps
): Command => {
  const command = new Command(SKILLS_COMMAND.name)
    .description(SKILLS_COMMAND.description)
    .addHelpText("after", SKILLS_MESSAGES.helpText);

  const infoCommand = new Command(SKILLS_COMMAND.info.name)
    .description(SKILLS_COMMAND.info.description)
    .argument("<skillName>", SKILLS_COMMAND.info.skillNameDescription)
    .action(async (skillName: string, _opts: Record<string, never>, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const result = await deps.getSkill(skillName);
        deps.printResult(result, ctx);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

  command.addCommand(infoCommand);
  const installCommand = new Command(SKILLS_COMMAND.install.name)
    .description(SKILLS_COMMAND.install.description)
    .argument("<skillName>", SKILLS_COMMAND.install.skillNameDescription)
    .option("--pin", SKILLS_COMMAND.install.flags.pin.description)
    .option("--overwrite", SKILLS_COMMAND.install.flags.overwrite.description)
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
            ...(opts.pin !== undefined && { pin: opts.pin }),
            ...(opts.overwrite !== undefined && { overwrite: opts.overwrite }),
          };

          const result = await deps.installSkill(skillName, options);
          deps.printResult(result, ctx);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          deps.error(`${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
          deps.setExitCode(1);
        }
      }
    );

  command.addCommand(installCommand);
  const uninstallCommand = new Command(SKILLS_COMMAND.uninstall.name)
    .description(SKILLS_COMMAND.uninstall.description)
    .argument("<skillName>", SKILLS_COMMAND.uninstall.skillNameDescription)
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

          const result = await deps.uninstallSkill(skillName, options);
          deps.printResult(result, ctx);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          deps.error(`${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
          deps.setExitCode(1);
        }
      }
    );

  command.addCommand(uninstallCommand);

  const listCommand = new Command(SKILLS_COMMAND.list.name)
    .description(SKILLS_COMMAND.list.description)
    .action(async (_opts: TSkillListCommandOptions, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const options: TSkillListOptions = {
          scope: ctx.scope,
        };

        const result = await deps.listSkills(options);
        if (result.length === 0 && ctx.outputFormat !== "json") {
          deps.printResult(`${logSymbols.warning} No installed skills found.`, ctx);
        } else {
          deps.printResult(result, ctx);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

  command.addCommand(listCommand);

  const updateCommand = new Command(SKILLS_COMMAND.update.name)
    .description(SKILLS_COMMAND.update.description)
    .argument("[skillName]", SKILLS_COMMAND.update.skillNameDescription)
    .option("--force", SKILLS_COMMAND.update.flags.force.description)
    .option("--all", SKILLS_COMMAND.update.flags.all.description)
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

          if (skillName !== undefined) {
            const result = await deps.updateSkill(skillName, options);
            deps.printResult(result, ctx);
          } else {
            const results = await deps.updateAllSkills(options);
            deps.printResult(results, ctx);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          deps.error(`${logSymbols.error} ${SKILLS_MESSAGES.failedPrefix} ${errorMessage}`);
          deps.setExitCode(1);
        }
      }
    );

  command.addCommand(updateCommand);
  command.addCommand(
    createSearchCommand({
      validateQuery: deps.validateQuery,
      search: deps.search,
      printResult: deps.printResult,
      error: deps.error,
      setExitCode: deps.setExitCode,
    })
  );

  return command;
};

export const skillCommand = createSkillCommand();
