import { SHARED_FLAGS } from "./flags";

export const GENERATE_COMMAND = {
  name: "generate",
  description:
    'Generate output from an installed skill. Get <skillVersionId> via "bp skill list" or "bp skill info <skill-slug>".',
  arguments: {
    skillVersionId: {
      name: "<skillVersionId>",
      description: "Skill version ID to run",
    },
  },
  flags: {
    input: {
      flag: "--input <key=value>",
      description: "Pass an input key/value pair. Can be repeated.",
    },
    imageInputUrl: {
      flag: "--image-input-url <url>",
      description: "Pass an image input URL. Can be repeated.",
    },
    imageInputBase64: {
      flag: "--image-input-base64 <base64>",
      description: "Pass a base64 image input. Can be repeated.",
    },
    inputPayload: {
      flag: "--input-payload <json>",
      description:
        'JSON object shaped like TRunInputs (example: \'{"textInputs":{"topic":"ai"}}\')',
    },
    stdin: {
      flag: "--stdin",
      description: "Read input payload from stdin",
    },
    model: {
      flag: "--model <model>",
      description: "Override generation model",
    },
    options: {
      flag: "--options <json>",
      description:
        'JSON object of run options (example: \'{"reasoningEffort":"high"}\')',
    },
    json: SHARED_FLAGS.json,
  },
} as const;

export const GENERATE_MESSAGES = {
  inputMissingArgumentFragment: "--input <key=value>",
  inputMissingArgumentHint:
    "Hint: pass --input as key=value (example: --input topic=ai).\n",
} as const;
