import { Command } from "commander";
import logSymbols from "log-symbols";
import { RUN_COMMAND, RUN_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import { getCommandContext } from "../core/context";
import { printResult } from "../core/output";
import type { TPrintOptions } from "../types";
import {
  createRun,
  getRun,
  parseInputsJson,
  parseRunOptionsJson,
  validateRunId,
  validateRunPayload,
} from "../core/run";
import type { TRunPayload } from "../types/run";

type TRunCommandOptions = {
  promptVersionId: string;
  inputs?: string;
  model?: string;
  runOptions?: string;
};

type TGetRunCommandOptions = {
  runId: string;
};

type TRunCommandDependencies = {
  run: (payload: TRunPayload) => Promise<unknown>;
  getRunById: (runId: string) => Promise<unknown>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: TRunCommandDependencies = {
  run: (payload) => createRun(getApiClient(), payload),
  getRunById: (runId) => getRun(getApiClient(), runId),
  printResult: (data, ctx) => printResult(data, ctx),
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
    .addHelpText("after", RUN_MESSAGES.helpText);

  const execCommand = new Command(RUN_COMMAND.exec.name)
    .description(RUN_COMMAND.exec.description)
    .requiredOption(
      RUN_COMMAND.exec.flags.promptVersionId.flag,
      RUN_COMMAND.exec.flags.promptVersionId.description
    )
    .option(
      RUN_COMMAND.exec.flags.inputs.flag,
      RUN_COMMAND.exec.flags.inputs.description
    )
    .option(
      RUN_COMMAND.exec.flags.runModel.flag,
      RUN_COMMAND.exec.flags.runModel.description
    )
    .option(
      RUN_COMMAND.exec.flags.runOptions.flag,
      RUN_COMMAND.exec.flags.runOptions.description
    );

  execCommand.action(async (opts: TRunCommandOptions, command: Command) => {
    try {
      const ctx = getCommandContext(command);
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
      deps.printResult(result, ctx);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      deps.error(`${logSymbols.error} ${RUN_MESSAGES.failedPrefix} ${errorMessage}`);
      deps.setExitCode(1);
    }
  });

  command.addCommand(execCommand);

  const getCommand = new Command(RUN_COMMAND.get.name)
    .description(RUN_COMMAND.get.description)
    .requiredOption(
      RUN_COMMAND.get.flags.runId.flag,
      RUN_COMMAND.get.flags.runId.description
    );

  getCommand.action(async (opts: TGetRunCommandOptions, command: Command) => {
    try {
      const ctx = getCommandContext(command);
      validateRunId(opts.runId);
      const result = await deps.getRunById(opts.runId);
      deps.printResult(result, ctx);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      deps.error(`${logSymbols.error} ${RUN_MESSAGES.failedPrefix} ${errorMessage}`);
      deps.setExitCode(1);
    }
  });

  command.addCommand(getCommand);

  return command;
};

export const runCommand = createRunCommand();
