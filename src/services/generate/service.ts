import logSymbols from "log-symbols";
import ora from "ora";
import { getApiClient } from "../../services/api/client";
import { runTaskWithSpinner } from "../error-ux/service";
import { printResult } from "../output/service";
import { persistRunOutput } from "../persistence/service";
import { createRun, parseInputsJson } from "../run/service";
import { resolveScope } from "../scope/service";
import type {
  TExecuteGenerateArgs,
  TGenerateCommandDependencies,
} from "../../commands/generate/types";
import { buildRunPayload, validateGenerateOptions } from "./parsers";
import { formatPartForTextOutput, isRunResult } from "./presenters";

const GENERATE_FAILED_PREFIX = "Generate command failed:";
export const GENERATE_STDIN_TTY_MESSAGE =
  "No stdin input detected. Pipe a TRunInputs JSON object when using --stdin.";

const readStdin = async (): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);
  });
};

export const createDefaultGenerateDependencies = (): TGenerateCommandDependencies => ({
  generate: async (payload) => {
    const result = await createRun(getApiClient(), payload);
    return result.data;
  },
  readStdin,
  isStdinTTY: () => process.stdin.isTTY === true,
  resolveScope,
  persistRunOutput,
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => {
    console.error(message);
  },
  setExitCode: (code) => {
    process.exitCode = code;
  },
});

export const executeGenerate = async ({
  ctx,
  deps,
  helpText,
  options,
  skillVersionId,
}: TExecuteGenerateArgs): Promise<void> => {
  try {
    validateGenerateOptions(options);

    let stdinInputs;
    if (options.stdin === true) {
      if (deps.isStdinTTY()) {
        throw new Error(GENERATE_STDIN_TTY_MESSAGE);
      }
      const rawStdin = await deps.readStdin();
      stdinInputs = parseInputsJson(rawStdin);
    }

    const payload = buildRunPayload({
      skillVersionId,
      options,
      stdinInputs,
    });

    const result = await runTaskWithSpinner({
      message: "Running skill generation...",
      createSpinner: (message) =>
        ora({ text: message, isEnabled: process.stderr.isTTY }),
      task: () => deps.generate(payload),
    });

    if (isRunResult(result)) {
      const scope = await deps.resolveScope(ctx);
      await deps.persistRunOutput({
        scope,
        runId: result.runId,
        skillVersionId,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.error(`${logSymbols.error} ${GENERATE_FAILED_PREFIX} ${errorMessage}`);
    deps.error(helpText);
    deps.setExitCode(1);
  }
};
