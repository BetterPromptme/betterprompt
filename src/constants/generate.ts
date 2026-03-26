import { SHARED_FLAGS } from "./shared-flags";

export const GENERATE_COMMAND = {
  name: "generate",
  description: "Generate output from an installed skill.",
  arguments: {
    skillSlug: {
      name: "<skill-slug>",
      description: "Installed skill name (slug) to generate output from",
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
    imageInputPath: {
      flag: "--image-input-path <path>",
      description: "Pass a local image file path. Can be repeated.",
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
  invalidPromptVersionId: "promptVersionId must not be empty.",
  inputsRequired: "You must provide --inputs.",
  invalidInputsJson: "inputs must be a valid JSON object.",
  invalidRunOptionsJson: "runOptions must be a valid JSON object.",
  invalidRunId: "runId must not be empty.",
} as const;
