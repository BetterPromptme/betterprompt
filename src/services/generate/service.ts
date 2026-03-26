import logSymbols from "log-symbols";
import ora from "ora";

import type {
  TExecuteGenerateArgs,
  TGenerateCommandDependencies,
} from "../../commands/generate/types";
import { ApiError, getApiClient } from "../../services/api/client";
import { runTaskWithSpinner } from "../error-ux/service";
import { printResult } from "../output/service";
import { persistRunOutput } from "../persistence/service";
import { createRun, parseInputsJson } from "../run/service";
import { resolveScope } from "../scope/service";
import { resolvePromptVersionId } from "../skills/resolver";
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

export const createDefaultGenerateDependencies =
  (): TGenerateCommandDependencies => ({
    generate: async (payload) => {
      const result = await createRun(getApiClient(), payload);
      return result.data;
    },
    readStdin,
    isStdinTTY: () => process.stdin.isTTY === true,
    resolveScope,
    resolvePromptVersionId,
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
  skillSlug,
}: TExecuteGenerateArgs): Promise<void> => {
  try {
    validateGenerateOptions(options);

    const scope = await deps.resolveScope(ctx);
    const promptVersionId = await deps.resolvePromptVersionId(
      skillSlug,
      scope.rootDir
    );

    let stdinInputs;
    if (options.stdin === true) {
      if (deps.isStdinTTY()) {
        throw new Error(GENERATE_STDIN_TTY_MESSAGE);
      }
      const rawStdin = await deps.readStdin();
      stdinInputs = parseInputsJson(rawStdin);
    }

    const payload = buildRunPayload({
      promptVersionId,
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
      await deps.persistRunOutput({
        scope,
        runId: result.runId,
        skillSlug,
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
    if (error instanceof ApiError) {
      handleApiError(error, ctx, deps, helpText);
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.error(`${logSymbols.error} ${GENERATE_FAILED_PREFIX} ${errorMessage}`);
    deps.error(helpText);
    deps.setExitCode(1);
  }
};

const extractDetailsField = (
  details: unknown
): { code?: string; data?: unknown } => {
  if (details && typeof details === "object") {
    const d = details as Record<string, unknown>;
    return {
      code: typeof d.status === "string" ? d.status : undefined,
      data: d.data ?? null,
    };
  }
  return { data: null };
};

const extractRunId = (data: unknown): string | undefined => {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return typeof d.runId === "string" ? d.runId : undefined;
  }
  return undefined;
};

const formatTextError = (error: ApiError): string => {
  const { data } = extractDetailsField(error.details);

  switch (error.status) {
    case 401:
      return "Not authenticated. Run `betterprompt login` to authenticate.";
    case 402:
      return "Insufficient credits or upgrade required. Visit https://betterprompt.me to manage your plan.";
    case 429:
      return "Rate limited. Wait a moment and try again.";
    case 504: {
      const runId = extractRunId(data);
      if (runId) {
        return `Generation timed out but may still be running. Check back with:\n  betterprompt outputs ${runId} --sync`;
      }
      return "Generation timed out but may still be running. Check back with:\n  betterprompt outputs list --remote";
    }
    case 400:
    case 404:
    case 422:
      return error.message;
    default:
      return "Server error. Try again later.";
  }
};

const handleApiError = (
  error: ApiError,
  ctx: TExecuteGenerateArgs["ctx"],
  deps: TGenerateCommandDependencies,
  helpText: string
): void => {
  if (ctx.outputFormat === "json") {
    const { code, data } = extractDetailsField(error.details);
    deps.printResult(
      {
        error: code ?? "UNKNOWN_ERROR",
        message: error.message,
        status: error.status,
        data,
      },
      ctx
    );
  } else {
    deps.error(
      `${logSymbols.error} ${GENERATE_FAILED_PREFIX} ${formatTextError(error)}`
    );
    deps.error(helpText);
  }

  deps.setExitCode(1);
};
