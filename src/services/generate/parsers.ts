import { existsSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

import type {
  TBuildRunPayloadArgs,
  TGenerateCommandOptions,
  TGenerateOptions,
} from "../../commands/generate/types";
import type {
  TImageInput,
  TImageInputBase64,
  TRunInputs,
  TRunPayload,
} from "../../types/run";
import { parseInputsJson, parseRunOptionsJson } from "../run/service";

const MAX_EDGE = 2048;
const JPEG_QUALITY = 80;

export const GENERATE_INPUT_PAYLOAD_EXCLUSIVE_MESSAGE =
  "--input-payload cannot be used with --input, --image-input-url, --image-input-path, or --stdin.";

export async function processImagePath(
  inputPath: string
): Promise<TImageInputBase64> {
  const resolvedPath = resolve(process.cwd(), inputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Image file not found: ${resolvedPath}`);
  }

  try {
    let pipeline = sharp(resolvedPath);
    const metadata = await pipeline.metadata();

    if (
      (metadata.width && metadata.width > MAX_EDGE) ||
      (metadata.height && metadata.height > MAX_EDGE)
    ) {
      pipeline = pipeline.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const buffer = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
    const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

    return { type: "base64", base64 };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process image: ${detail}`);
  }
}

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

const buildImageInputs = async (
  options: TGenerateOptions
): Promise<TImageInput[]> => {
  const urlInputs = (options.imageInputUrl ?? []).map((url) => ({
    type: "url" as const,
    url,
  }));
  const pathInputs = await Promise.all(
    (options.imageInputPath ?? []).map((p) => processImagePath(p))
  );

  return [...urlInputs, ...pathInputs];
};

const mergeRunInputs = async (
  baseInputs: TRunInputs | undefined,
  options: TGenerateOptions
): Promise<TRunInputs> => {
  const textInputs = {
    ...(baseInputs?.textInputs ?? {}),
    ...buildTextInputs(options.input),
  };
  const imageInputsFromFlags = await buildImageInputs(options);

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
    (options.imageInputPath !== undefined &&
      options.imageInputPath.length > 0) ||
    options.stdin === true;

  if (hasOtherInputFlags) {
    throw new Error(GENERATE_INPUT_PAYLOAD_EXCLUSIVE_MESSAGE);
  }
};

export const buildGenerateOptions = (
  opts: TGenerateCommandOptions
): TGenerateOptions => ({
  ...(opts.input !== undefined &&
    opts.input.length > 0 && { input: opts.input }),
  ...(opts.imageInputUrl !== undefined &&
    opts.imageInputUrl.length > 0 && { imageInputUrl: opts.imageInputUrl }),
  ...(opts.imageInputPath !== undefined &&
    opts.imageInputPath.length > 0 && {
      imageInputPath: opts.imageInputPath,
    }),
  ...(opts.inputPayload !== undefined && { inputPayload: opts.inputPayload }),
  ...(opts.stdin === true && { stdin: true }),
  ...(opts.model !== undefined && { model: opts.model }),
  ...(opts.options !== undefined && { options: opts.options }),
});

export const buildRunPayload = async ({
  promptVersionId,
  options,
  stdinInputs,
}: TBuildRunPayloadArgs): Promise<TRunPayload> => {
  const runOptions = parseRunOptionsJson(options.options);
  const sourceInputs = resolveSourceInputs(options, stdinInputs);
  const inputs = await mergeRunInputs(sourceInputs, options);

  return {
    promptVersionId,
    inputs,
    ...(options.model !== undefined && { runModel: options.model }),
    ...(runOptions !== undefined && { runOptions }),
  };
};
