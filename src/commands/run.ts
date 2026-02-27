import { Command } from "commander";
import { RUN_COMMAND, RUN_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import {
  createRun,
  parseInputsJson,
  parseRunOptionsJson,
  validateRunPayload,
} from "../core/run";
import type { TRunPayload } from "../types/run";

type TRunCommandOptions = {
  promptVersionId: string;
  inputs?: string;
  model?: string;
  runOptions?: string;
};

type TRunCommandDependencies = {
  run: (payload: TRunPayload) => Promise<unknown>;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TRunCommandDependencies = {
  run: (payload) => createRun(getApiClient(), payload),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createRunCommand = (
  deps: TRunCommandDependencies = defaultDeps
): Command => {
  const command = new Command(RUN_COMMAND.name)
    .description(RUN_COMMAND.description)
    .requiredOption(
      RUN_COMMAND.flags.promptVersionId.flag,
      RUN_COMMAND.flags.promptVersionId.description
    )
    .option(
      RUN_COMMAND.flags.inputs.flag,
      RUN_COMMAND.flags.inputs.description
    )
    .option(
      RUN_COMMAND.flags.runModel.flag,
      RUN_COMMAND.flags.runModel.description
    )
    .option(
      RUN_COMMAND.flags.runOptions.flag,
      RUN_COMMAND.flags.runOptions.description
    )
    .addHelpText("after", RUN_MESSAGES.helpText);

  command.action(async (opts: TRunCommandOptions) => {
    try {
      const inputs =
        opts.inputs !== undefined ? parseInputsJson(opts.inputs) : undefined;
      const runOptions = parseRunOptionsJson(opts.runOptions);

      const payload: TRunPayload = {
        promptVersionId: opts.promptVersionId,
        ...(inputs !== undefined && { inputs }),
        ...(opts.model !== undefined && { runModel: opts.model }),
        ...(runOptions !== undefined && { runOptions }),
      };

      validateRunPayload(payload);

      const result = await deps.run(payload);
      deps.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      deps.error(`${RUN_MESSAGES.failedPrefix} ${errorMessage}`);
      deps.setExitCode(1);
    }
  });

  return command;
};

export const runCommand = createRunCommand();
