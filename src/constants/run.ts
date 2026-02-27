export const RUN_COMMAND = {
  name: "run",
  description: "Run-related commands for BetterPrompt",
  exec: {
    name: "exec",
    description: "Execute a prompt version via BetterPrompt",
    flags: {
      promptVersionId: {
        flag: "--promptVersionId <uuid>",
        description: "UUID of the prompt version to run",
      },
      inputs: {
        flag: "--inputs <json>",
        description:
          'Structured inputs as JSON, e.g. \'{"textInputs":{"key":"value"},"imageInputs":[]}\'',
      },
      runModel: {
        flag: "--model <model>",
        description: "Override the default model for this run (optional)",
      },
      runOptions: {
        flag: "--runOptions <json>",
        description:
          'JSON object of run options, e.g. \'{"reasoningEffort":"high","quality":"hd"}\' (optional)',
      },
    },
  },
  get: {
    name: "get",
    description: "Get a run by ID",
    flags: {
      runId: {
        flag: "--runId <uuid>",
        description: "UUID of the run to retrieve",
      },
    },
  },
} as const;

export const RUN_MESSAGES = {
  helpText: `
Examples:
  $ betterprompt run exec --promptVersionId <uuid> --inputs '{"textInputs":{"Your_text":"Hello world"}}'
  $ betterprompt run exec --promptVersionId <uuid> --inputs '{"textInputs":{},"imageInputs":[{"type":"url","url":"https://example.com/img.png"}]}' --model gpt-4o
  $ betterprompt run exec --promptVersionId <uuid> --inputs '{"textInputs":{}}' --runOptions '{"reasoningEffort":"high"}'
`,
  invalidPromptVersionId: "promptVersionId must not be empty.",
  inputsRequired: "You must provide --inputs.",
  invalidInputsJson: "inputs must be a valid JSON object.",
  invalidRunOptionsJson: "runOptions must be a valid JSON object.",
  invalidRunId: "runId must not be empty.",
  failedPrefix: "Run command failed:",
} as const;
