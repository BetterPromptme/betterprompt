import { Argument, Command } from "commander";
import { getCommandContext } from "../context/service";
import { runTaskWithSpinner } from "../error-ux/service";
import { createDefaultCommandFactoryDeps } from "./deps";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type {
  TCommandSpec,
  TParentCommandSpec,
  TFlagSpec,
  TArgumentSpec,
  TCommandHandler,
  TValidateFn,
} from "../../types/command-spec";
import type { TCliContext } from "../../types/context";

const DEFAULT_ERROR_PREFIX = "Command failed:";

const applyFlags = (cmd: Command, flags: Record<string, TFlagSpec>): void => {
  for (const flagSpec of Object.values(flags)) {
    if (flagSpec.collect) {
      const collectDefault = Array.isArray(flagSpec.default)
        ? (flagSpec.default as string[])
        : [];
      cmd.option(
        flagSpec.flag,
        flagSpec.description,
        flagSpec.collect,
        collectDefault
      );
    } else if (flagSpec.default !== undefined) {
      cmd.option(
        flagSpec.flag,
        flagSpec.description,
        flagSpec.default as string | boolean | string[]
      );
    } else {
      cmd.option(flagSpec.flag, flagSpec.description);
    }
  }
};

const applyArguments = (cmd: Command, args: TArgumentSpec[]): void => {
  for (const argSpec of args) {
    if (argSpec.parse) {
      cmd.addArgument(
        new Argument(argSpec.name, argSpec.description).argParser(argSpec.parse)
      );
    } else {
      cmd.argument(argSpec.name, argSpec.description);
    }
  }
};

type TActionSpec<TOpts> = {
  arguments?: TArgumentSpec[];
  handler: TCommandHandler<TOpts>;
  spinnerMessage?: string;
  formatText?: (result: unknown, ctx: TCliContext) => unknown;
  validate?: TValidateFn<TOpts>;
  errorPrefix?: string;
};

const wireAction = <TOpts>(
  cmd: Command,
  spec: TActionSpec<TOpts>,
  deps: TCommandFactoryDeps
): void => {
  cmd.action(async (...actionArgs: unknown[]) => {
    const command = actionArgs[actionArgs.length - 1] as Command;
    const opts = actionArgs[actionArgs.length - 2] as TOpts;
    const positionalArgs = actionArgs.slice(0, actionArgs.length - 2);

    const args: Record<string, unknown> = {};
    if (spec.arguments) {
      spec.arguments.forEach((argSpec, i) => {
        args[argSpec.name] = positionalArgs[i];
      });
    }

    try {
      const ctx = getCommandContext(command);

      if (spec.validate) {
        const validationError = spec.validate({ opts, args, ctx });
        if (validationError !== undefined) {
          const prefix = spec.errorPrefix ?? DEFAULT_ERROR_PREFIX;
          deps.error(`${prefix} ${validationError}`);
          deps.setExitCode(1);
          return;
        }
      }

      let result: unknown;
      if (spec.spinnerMessage) {
        result = await runTaskWithSpinner({
          message: spec.spinnerMessage,
          createSpinner: deps.createSpinner,
          task: () =>
            spec.handler({
              opts,
              args,
              ctx,
              command,
              setExitCode: deps.setExitCode,
              deps,
            }),
        });
      } else {
        result = await spec.handler({
          opts,
          args,
          ctx,
          command,
          setExitCode: deps.setExitCode,
          deps,
        });
      }

      if (result !== undefined) {
        if (ctx.outputFormat !== "json" && spec.formatText) {
          deps.printResult(spec.formatText(result, ctx), ctx);
        } else {
          deps.printResult(result, ctx);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const prefix = spec.errorPrefix ?? DEFAULT_ERROR_PREFIX;
      deps.error(`${prefix} ${message}`);
      deps.setExitCode(1);
    }
  });
};

export const createCommandFromSpec = <TOpts = Record<string, unknown>>(
  spec: TCommandSpec<TOpts>,
  factoryDeps?: Partial<TCommandFactoryDeps>
): Command => {
  const deps = { ...createDefaultCommandFactoryDeps(), ...factoryDeps };
  const cmd = new Command(spec.name).description(spec.description);

  if (spec.flags) {
    applyFlags(cmd, spec.flags);
  }

  if (spec.arguments) {
    applyArguments(cmd, spec.arguments);
  }

  if (spec.helpText) {
    cmd.addHelpText("after", spec.helpText);
  }

  if (spec.configureOutput) {
    cmd.configureOutput(spec.configureOutput);
  }

  if (spec.showHelpAfterError) {
    cmd.showHelpAfterError();
  }

  if (spec.showSuggestionAfterError) {
    cmd.showSuggestionAfterError();
  }

  if (spec.customAction) {
    spec.customAction(cmd, deps);
    return cmd;
  }

  wireAction(cmd, spec, deps);

  return cmd;
};

export const createParentCommandFromSpec = <TOpts = Record<string, unknown>>(
  spec: TParentCommandSpec<TOpts>,
  factoryDeps?: Partial<TCommandFactoryDeps>
): Command => {
  const deps = { ...createDefaultCommandFactoryDeps(), ...factoryDeps };
  const cmd = new Command(spec.name).description(spec.description);

  if (spec.flags) {
    applyFlags(cmd, spec.flags);
  }

  if (spec.arguments) {
    applyArguments(cmd, spec.arguments);
  }

  if (spec.helpText) {
    cmd.addHelpText("after", spec.helpText);
  }

  // TODO: Phase 4 – add configureOutput, showHelpAfterError, showSuggestionAfterError
  // support to parent commands when migrating config, outputs, and skill commands.

  if (spec.handler) {
    wireAction(cmd, spec as TActionSpec<TOpts>, deps);
  }

  for (const subcommand of spec.subcommands) {
    cmd.addCommand(subcommand);
  }

  return cmd;
};
