import type { TPrintOptions } from "./output";
import type { TPersistRunOutputArgs, TPersistRunOutputResult } from "./persistence";
import type { TResolveScope } from "./scope";
import type { TRunPayload } from "./run";

export type TGenerateOptions = {
  input?: string[];
  imageInputUrl?: string[];
  imageInputBase64?: string[];
  inputPayload?: string;
  stdin?: boolean;
  model?: string;
  options?: string;
};

export type TGenerateResult = {
  runId: string;
  status: string;
};

export type TGenerateCommandOptions = TGenerateOptions;

export type TGenerateCommandDependencies = {
  generate: (payload: TRunPayload) => Promise<unknown>;
  readStdin: () => Promise<string>;
  isStdinTTY: () => boolean;
  resolveScope: TResolveScope;
  persistRunOutput: (
    args: TPersistRunOutputArgs
  ) => Promise<TPersistRunOutputResult>;
  printResult: (data: unknown, ctx: TPrintOptions) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

export type TInputValues = Record<string, string>;

export type TJsonSchemaProperty = {
  type?: string;
  minLength?: number;
};

export type TJsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, TJsonSchemaProperty>;
};

export type TValidationDetail = {
  field: string;
  message: string;
};

export type TResolveInputsOptions = {
  input?: string[];
  stdinJson?: string;
  defaults?: TInputValues;
  interactive?: boolean;
  schema?: TJsonSchema;
  promptForMissing?: (fields: string[]) => Promise<TInputValues>;
};

export type TResolvedInputsResult = {
  inputs: TInputValues;
};
