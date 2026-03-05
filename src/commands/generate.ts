import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import { persistRunOutput } from "../core/persistence";
import { createRun, parseRunOptionsJson } from "../core/run";
import { resolveScope } from "../core/scope";
import { getApiClient } from "../core/api";
import { PART_TYPE } from "../enums";
import type {
  TGenerateCommandDependencies,
  TGenerateCommandOptions,
  TGenerateOptions,
} from "../types/generate";
import type { TPart } from "../types/output";
import type { TRunResult } from "../types/run";
import type { TRunPayload } from "../types/run";

const GENERATE_FAILED_PREFIX = "Generate command failed:";
const GENERATE_INPUT_MISSING_ARGUMENT_FRAGMENT = "--input <key=value>";
const GENERATE_INPUT_MISSING_ARGUMENT_HINT =
  "Hint: pass --input as key=value (example: --input topic=ai).\n";
const GENERATE_DESCRIPTION =
  'Generate output from an installed skill. Get <skillVersionId> via "bp skill list" or "bp skill info <skill-slug>".';

const collectInputPairs = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

const buildTextInputs = (
  input: string[] | undefined
): Record<string, string> => {
  if (input === undefined || input.length === 0) {
    return {};
  }

  return input.reduce<Record<string, string>>((acc, pair) => {
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex < 0) {
      const key = pair.trim();
      if (key.length > 0) {
        acc[key] = "";
      }
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    if (key.length === 0) {
      return acc;
    }

    acc[key] = pair.slice(separatorIndex + 1);
    return acc;
  }, {});
};

const defaultDeps: TGenerateCommandDependencies = {
  generate: async (skillVersionId, options) => {
    const payload = buildRunPayload(skillVersionId, options);
    const result = await createRun(getApiClient(), payload);

    return result.data;
  },
  resolveScope,
  persistRunOutput,
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const buildGenerateOptions = (
  opts: TGenerateCommandOptions
): TGenerateOptions => ({
  ...(opts.input !== undefined &&
    opts.input.length > 0 && { input: opts.input }),
  ...(opts.stdin === true && { stdin: true }),
  ...(opts.interactive === true && { interactive: true }),
  ...(opts.model !== undefined && { model: opts.model }),
  ...(opts.runOption !== undefined && { runOption: opts.runOption }),
});

const buildRunPayload = (
  skillVersionId: string,
  options: TGenerateOptions
): TRunPayload => {
  const runOptions = parseRunOptionsJson(options.runOption);
  return {
    promptVersionId: skillVersionId,
    inputs: {
      textInputs: buildTextInputs(options.input),
    },
    ...(options.model !== undefined && { runModel: options.model }),
    ...(runOptions !== undefined && { runOptions }),
  };
};

const isRunResult = (value: unknown): value is TRunResult => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TRunResult>;
  return (
    typeof candidate.runId === "string" &&
    Array.isArray(candidate.outputs) &&
    typeof candidate.runStatus === "string"
  );
};

const formatPartForTextOutput = (part: TPart): string => {
  switch (part.type) {
    case PART_TYPE.TEXT:
    case PART_TYPE.IMAGE:
    case PART_TYPE.ERROR:
    case PART_TYPE.VIDEO:
      return part.data;
    default:
      return part.data;
  }
};

export const formatGenerateOptionErrorMessage = (message: string): string => {
  if (message.includes(GENERATE_INPUT_MISSING_ARGUMENT_FRAGMENT)) {
    return `${message}${GENERATE_INPUT_MISSING_ARGUMENT_HINT}`;
  }

  return message;
};

export const createGenerateCommand = (
  deps: TGenerateCommandDependencies = defaultDeps
): Command =>
  new Command("generate")
    .description(GENERATE_DESCRIPTION)
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      outputError: (message, write) => {
        write(formatGenerateOptionErrorMessage(message));
      },
    })
    .argument("<skillVersionId>", "Skill version ID to run")
    .option(
      "--input <key=value>",
      "Pass an input key/value pair. Can be repeated.",
      collectInputPairs,
      []
    )
    .option("--stdin", "Read input payload from stdin")
    .option("--interactive", "Prompt interactively for required inputs")
    .option("--model <model>", "Override generation model")
    .option(
      "--run-option <json>",
      "JSON object of run options (example: '{\"reasoningEffort\":\"high\"}')"
    )
    .option("--json", "Render output as JSON")
    .action(
      async (
        skillVersionId: string,
        opts: TGenerateCommandOptions,
        command: Command
      ) => {
        try {
          const ctx = getCommandContext(command);
          const options = buildGenerateOptions(opts);
          const payload = buildRunPayload(skillVersionId, options);
          const result = await runTaskWithSpinner({
            message: "Running skill generation...",
            createSpinner: (message) =>
              ora({ text: message, isEnabled: process.stderr.isTTY }),
            task: () => deps.generate(skillVersionId, options),
          });

          if (isRunResult(result)) {
            const scope = await deps.resolveScope(ctx);
            await deps.persistRunOutput({
              scope,
              runId: result.runId,
              skillVersionId: skillVersionId,
              request: payload,
              response: result,
              metadata: {
                runStatus: result.runStatus,
                persistedAt: new Date().toISOString(),
              },
            });
          }

          if (ctx.outputFormat === "json") {
            deps.printResult(result, ctx);
            return;
          }

          if (!isRunResult(result) || result.outputs.length === 0) {
            deps.printResult(result, ctx);
            return;
          }

          result.outputs.forEach((part) => {
            deps.printResult(formatPartForTextOutput(part), ctx);
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          deps.error(
            `${logSymbols.error} ${GENERATE_FAILED_PREFIX} ${errorMessage}`
          );
          deps.error(command.helpInformation());
          deps.setExitCode(1);
        }
      }
    );

export const generateCommand = createGenerateCommand();
