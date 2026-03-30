import {
  GENERATE_COMMAND,
  GENERATE_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../constants";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { getCommandContext } from "../../services/context/service";
import { buildGenerateOptions } from "../../services/generate/parsers";
import {
  createDefaultGenerateDependencies,
  executeGenerate,
} from "../../services/generate/service";
import {
  extractErrorData,
  getErrorType,
  track,
} from "../../services/telemetry/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type {
  TGenerateCommandDependencies,
  TGenerateCommandOptions,
} from "./types";

const collectInputPairs = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

export const formatGenerateOptionErrorMessage = (message: string): string => {
  if (message.includes(GENERATE_MESSAGES.inputMissingArgumentFragment)) {
    return `${message}${GENERATE_MESSAGES.inputMissingArgumentHint}`;
  }

  return message;
};

export const createGenerateCommand = (
  deps: TGenerateCommandDependencies = createDefaultGenerateDependencies(),
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TGenerateCommandOptions>(
    {
      name: GENERATE_COMMAND.name,
      description: GENERATE_COMMAND.description,
      showHelpAfterError: true,
      showSuggestionAfterError: true,
      configureOutput: {
        outputError: (message, write) => {
          write(formatGenerateOptionErrorMessage(message));
        },
      },
      arguments: [
        {
          name: GENERATE_COMMAND.arguments.skillSlug.name,
          description: GENERATE_COMMAND.arguments.skillSlug.description,
        },
      ],
      flags: {
        input: {
          ...GENERATE_COMMAND.flags.input,
          collect: collectInputPairs,
          default: [],
        },
        imageInputUrl: {
          ...GENERATE_COMMAND.flags.imageInputUrl,
          collect: collectInputPairs,
          default: [],
        },
        imageInputPath: {
          ...GENERATE_COMMAND.flags.imageInputPath,
          collect: collectInputPairs,
          default: [],
        },
        inputPayload: GENERATE_COMMAND.flags.inputPayload,
        stdin: GENERATE_COMMAND.flags.stdin,
        model: GENERATE_COMMAND.flags.model,
        options: GENERATE_COMMAND.flags.options,
        json: GENERATE_COMMAND.flags.json,
      },
      customAction: (cmd, _factoryDeps) => {
        cmd.action(
          async (skillSlug: string, opts: TGenerateCommandOptions, command) => {
            const start = performance.now();
            try {
              await executeGenerate({
                skillSlug,
                options: buildGenerateOptions(opts),
                ctx: getCommandContext(command),
                helpText: cmd.helpInformation(),
                deps,
              });
              void track({
                command: TELEMETRY_COMMANDS.generate,
                startedAt: start,
                metadata: {
                  skillSlug,
                  model: opts.model as string | undefined,
                },
              });
            } catch (error) {
              void track({
                command: TELEMETRY_COMMANDS.generate,
                startedAt: start,
                metadata: {
                  skillSlug,
                  model: opts.model as string | undefined,
                  errorType: getErrorType(error),
                  errorData: extractErrorData(error),
                },
              });
              const message =
                error instanceof Error ? error.message : String(error);
              deps.error(message);
              deps.setExitCode(1);
            }
          }
        );
      },
    },
    factoryDeps
  );

export const generateCommand = createGenerateCommand();
