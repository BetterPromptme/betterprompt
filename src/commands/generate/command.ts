import { GENERATE_COMMAND, GENERATE_MESSAGES } from "../../constants";
import { getCommandContext } from "../../services/context/service";
import { createCommandFromSpec } from "../../services/command-factory/service";
import type { TGenerateCommandDependencies, TGenerateCommandOptions } from "./types";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { buildGenerateOptions } from "../../services/generate/parsers";
import {
  createDefaultGenerateDependencies,
  executeGenerate,
} from "../../services/generate/service";

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
          name: GENERATE_COMMAND.arguments.skillVersionId.name,
          description: GENERATE_COMMAND.arguments.skillVersionId.description,
        },
      ],
      flags: {
        input: { ...GENERATE_COMMAND.flags.input, collect: collectInputPairs, default: [] },
        imageInputUrl: { ...GENERATE_COMMAND.flags.imageInputUrl, collect: collectInputPairs, default: [] },
        imageInputBase64: { ...GENERATE_COMMAND.flags.imageInputBase64, collect: collectInputPairs, default: [] },
        inputPayload: GENERATE_COMMAND.flags.inputPayload,
        stdin: GENERATE_COMMAND.flags.stdin,
        model: GENERATE_COMMAND.flags.model,
        options: GENERATE_COMMAND.flags.options,
        json: GENERATE_COMMAND.flags.json,
      },
      customAction: (cmd, _factoryDeps) => {
        cmd.action(async (skillVersionId: string, opts: TGenerateCommandOptions, command) => {
          await executeGenerate({
            skillVersionId,
            options: buildGenerateOptions(opts),
            ctx: getCommandContext(command),
            helpText: cmd.helpInformation(),
            deps,
          });
        });
      },
    },
    factoryDeps
  );

export const generateCommand = createGenerateCommand();
