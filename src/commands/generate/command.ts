import { Command } from "commander";
import { GENERATE_COMMAND, GENERATE_MESSAGES } from "../../constants";
import { getCommandContext } from "../../services/context/service";
import type { TGenerateCommandDependencies, TGenerateCommandOptions } from "./types";
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
  deps: TGenerateCommandDependencies = createDefaultGenerateDependencies()
): Command =>
  new Command(GENERATE_COMMAND.name)
    .description(GENERATE_COMMAND.description)
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      outputError: (message, write) => {
        write(formatGenerateOptionErrorMessage(message));
      },
    })
    .argument(
      GENERATE_COMMAND.arguments.skillVersionId.name,
      GENERATE_COMMAND.arguments.skillVersionId.description
    )
    .option(
      GENERATE_COMMAND.flags.input.flag,
      GENERATE_COMMAND.flags.input.description,
      collectInputPairs,
      []
    )
    .option(
      GENERATE_COMMAND.flags.imageInputUrl.flag,
      GENERATE_COMMAND.flags.imageInputUrl.description,
      collectInputPairs,
      []
    )
    .option(
      GENERATE_COMMAND.flags.imageInputBase64.flag,
      GENERATE_COMMAND.flags.imageInputBase64.description,
      collectInputPairs,
      []
    )
    .option(
      GENERATE_COMMAND.flags.inputPayload.flag,
      GENERATE_COMMAND.flags.inputPayload.description
    )
    .option(GENERATE_COMMAND.flags.stdin.flag, GENERATE_COMMAND.flags.stdin.description)
    .option(GENERATE_COMMAND.flags.model.flag, GENERATE_COMMAND.flags.model.description)
    .option(
      GENERATE_COMMAND.flags.options.flag,
      GENERATE_COMMAND.flags.options.description
    )
    .option(GENERATE_COMMAND.flags.json.flag, GENERATE_COMMAND.flags.json.description)
    .action(
      async (
        skillVersionId: string,
        opts: TGenerateCommandOptions,
        command: Command
      ) => {
        await executeGenerate({
          skillVersionId,
          options: buildGenerateOptions(opts),
          ctx: getCommandContext(command),
          helpText: command.helpInformation(),
          deps,
        });
      }
    );

export const generateCommand = createGenerateCommand();
