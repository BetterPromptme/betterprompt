import type { TPrintOptions, TPart } from "../../types/output";
import type {
  TPersistRunOutputArgs,
  TPersistRunOutputResult,
} from "../../types/persistence";
import type { TCliContext } from "../../types/context";
import type { TRunInputs, TRunPayload, TRunResult, TImageInput } from "../../types/run";
import type { TResolveScope } from "../../types/scope";

export type TGenerateOptions = {
  input?: string[];
  imageInputUrl?: string[];
  imageInputBase64?: string[];
  inputPayload?: string;
  stdin?: boolean;
  model?: string;
  options?: string;
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

export type TExecuteGenerateArgs = {
  ctx: TCliContext;
  deps: TGenerateCommandDependencies;
  helpText: string;
  options: TGenerateOptions;
  skillVersionId: string;
};

export type TBuildRunPayloadArgs = {
  options: TGenerateOptions;
  skillVersionId: string;
  stdinInputs?: TRunInputs;
};

export type TGenerateRunResult = Pick<TRunResult, "runId" | "outputs" | "runStatus">;

export type TFormatGeneratePart = (part: TPart) => string;

export type TBuildImageInputs = (options: TGenerateOptions) => TImageInput[];
