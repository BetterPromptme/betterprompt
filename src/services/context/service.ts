import type { Command } from "commander";
import type { TCliContext, TScope, TVerbosity } from "../../types/context";

const asBoolean = (value: unknown): boolean => value === true;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const resolveScope = (
  projectFlag: boolean,
  globalFlag: boolean,
  dirFlag: string | undefined
): TScope => {
  if (dirFlag !== undefined) {
    return {
      type: "dir",
      path: dirFlag,
    };
  }

  if (projectFlag && globalFlag) {
    throw new Error("Cannot use --project and --global together");
  }

  if (projectFlag) {
    return { type: "project" };
  }

  return { type: "global" };
};

const resolveVerbosity = (quietFlag: boolean, verboseFlag: boolean): TVerbosity => {
  if (quietFlag && verboseFlag) {
    throw new Error("Cannot use --quiet and --verbose together");
  }

  if (quietFlag) {
    return "quiet";
  }

  if (verboseFlag) {
    return "verbose";
  }

  return "normal";
};

export const resolveContext = (flags: Record<string, unknown>): TCliContext => {
  const projectFlag = asBoolean(flags.project);
  const globalFlag = asBoolean(flags.global);
  const dirFlag = asNonEmptyString(flags.dir);
  const quietFlag = asBoolean(flags.quiet);
  const verboseFlag = asBoolean(flags.verbose);

  return {
    scope: resolveScope(projectFlag, globalFlag, dirFlag),
    outputFormat: asBoolean(flags.json) ? "json" : "text",
    verbosity: resolveVerbosity(quietFlag, verboseFlag),
    registry: asNonEmptyString(flags.registry),
    yes: asBoolean(flags.yes),
    color: flags.color !== false,
  };
};

export const getCommandContext = (command: Command): TCliContext => {
  const options = command.optsWithGlobals<Record<string, unknown>>();
  return resolveContext(options);
};
