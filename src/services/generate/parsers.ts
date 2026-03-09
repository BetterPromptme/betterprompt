import { parseInputsJson, parseRunOptionsJson } from "../run/service";
import type { TRunInputs, TRunPayload } from "../../types/run";
import type {
  TBuildRunPayloadArgs,
  TGenerateCommandOptions,
  TGenerateOptions,
} from "../../commands/generate/types";

export const GENERATE_INPUT_PAYLOAD_EXCLUSIVE_MESSAGE =
  "--input-payload cannot be used with --input, --image-input-url, --image-input-base64, or --stdin.";

const buildTextInputs = (input: string[] | undefined): Record<string, string> => {
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

const buildImageInputs = (options: TGenerateOptions) => {
  const urlInputs = (options.imageInputUrl ?? []).map((url) => ({
    type: "url" as const,
    url,
  }));
  const base64Inputs = (options.imageInputBase64 ?? []).map((base64) => ({
    type: "base64" as const,
    base64,
  }));

  return [...urlInputs, ...base64Inputs];
};

const mergeRunInputs = (
  baseInputs: TRunInputs | undefined,
  options: TGenerateOptions
): TRunInputs => {
  const textInputs = {
    ...(baseInputs?.textInputs ?? {}),
    ...buildTextInputs(options.input),
  };
  const imageInputsFromFlags = buildImageInputs(options);

  return {
    textInputs,
    ...(imageInputsFromFlags.length > 0
      ? { imageInputs: imageInputsFromFlags }
      : baseInputs?.imageInputs !== undefined && {
          imageInputs: baseInputs.imageInputs,
        }),
  };
};

const resolveSourceInputs = (
  options: TGenerateOptions,
  stdinInputs: TRunInputs | undefined
): TRunInputs | undefined => {
  if (options.inputPayload !== undefined) {
    return parseInputsJson(options.inputPayload);
  }

  return stdinInputs;
};

export const validateGenerateOptions = (options: TGenerateOptions): void => {
  if (options.inputPayload === undefined) {
    return;
  }

  const hasOtherInputFlags =
    (options.input !== undefined && options.input.length > 0) ||
    (options.imageInputUrl !== undefined && options.imageInputUrl.length > 0) ||
    (options.imageInputBase64 !== undefined &&
      options.imageInputBase64.length > 0) ||
    options.stdin === true;

  if (hasOtherInputFlags) {
    throw new Error(GENERATE_INPUT_PAYLOAD_EXCLUSIVE_MESSAGE);
  }
};

export const buildGenerateOptions = (
  opts: TGenerateCommandOptions
): TGenerateOptions => ({
  ...(opts.input !== undefined && opts.input.length > 0 && { input: opts.input }),
  ...(opts.imageInputUrl !== undefined &&
    opts.imageInputUrl.length > 0 && { imageInputUrl: opts.imageInputUrl }),
  ...(opts.imageInputBase64 !== undefined &&
    opts.imageInputBase64.length > 0 && {
      imageInputBase64: opts.imageInputBase64,
    }),
  ...(opts.inputPayload !== undefined && { inputPayload: opts.inputPayload }),
  ...(opts.stdin === true && { stdin: true }),
  ...(opts.model !== undefined && { model: opts.model }),
  ...(opts.options !== undefined && { options: opts.options }),
});

export const buildRunPayload = ({
  skillVersionId,
  options,
  stdinInputs,
}: TBuildRunPayloadArgs): TRunPayload => {
  const runOptions = parseRunOptionsJson(options.options);
  const sourceInputs = resolveSourceInputs(options, stdinInputs);
  const inputs = mergeRunInputs(sourceInputs, options);

  return {
    promptVersionId: skillVersionId,
    inputs,
    ...(options.model !== undefined && { runModel: options.model }),
    ...(runOptions !== undefined && { runOptions }),
  };
};
