import { z } from "zod/v4";

export type TTextVariableInputMetadata = {
  [key: string]: unknown;
  type: INPUT_TYPE.TEXT;
  description?: string;
  allowEmpty?: boolean;
  defaultValues?: string[];
};

export type TSelectVariableInputMetadata = {
  [key: string]: unknown;
  type: INPUT_TYPE.SELECT;
  description?: string;
  /**
   * Is the select input multiple
   *
   * If `multiple` is `true`, default separator is `, `
   */
  multiple?:
    | {
        /**
         * The maximum number of options that can be selected
         */
        max?: number;
        /**
         * The minimum number of options that must be selected
         */
        min?: number;
      }
    | true;
  options: {
    [optionName: string]: string;
  };
};

export type TVariableInputMetadata =
  | TTextVariableInputMetadata
  | TSelectVariableInputMetadata;

export type TImageInputMetadata = {
  [key: string]: unknown;
  description?: string;
};

export type TInputMetadata = {
  variables: {
    [name: string]: TVariableInputMetadata;
  };
  images: TImageInputMetadata[];
};

enum INPUT_TYPE {
  TEXT,
  SELECT,
  IMAGE,
}

const imageItem = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    url: z.string().check(
      z.url({
        protocol: /^https?$/,
      })
    ),
  }),
  z.object({
    type: z.literal("base64"),
    base64: z.base64(),
  }),
]);

export function generateZodSchema(metadata: TInputMetadata) {
  const textShape: Record<string, z.ZodString> = {};

  for (const [name, varMeta] of Object.entries(metadata.variables)) {
    const allowEmpty =
      varMeta.type === INPUT_TYPE.TEXT && varMeta.allowEmpty === true;
    textShape[name] = allowEmpty ? z.string() : z.string().min(1);
  }

  return z.object({
    textInputs: z.object(textShape),
    imageInputs: z.array(imageItem).length(metadata.images.length),
  });
}
