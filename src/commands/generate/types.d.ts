import type { TCliContext } from "../../types/context";
import type { TPart, TPrintOptions } from "../../types/outputs";
import type {
  TPersistRunOutputArgs,
  TPersistRunOutputResult,
} from "../../types/persistence";
import type {
  TImageInput,
  TRunInputs,
  TRunPayload,
  TRunResult,
} from "../../types/run";
import type { TResolveScope } from "../../types/scope";

export type TGenerateOptions = {
  input?: string[];
  imageInputUrl?: string[];
  imageInputPath?: string[];
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
  resolvePromptVersionId: (slug: string, rootDir: string) => Promise<string>;
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
  skillSlug: string;
};

export type TBuildRunPayloadArgs = {
  options: TGenerateOptions;
  promptVersionId: string;
  stdinInputs?: TRunInputs;
};

export type TGenerateRunResult = Pick<
  TRunResult,
  "runId" | "outputs" | "runStatus"
>;

export type TFormatGeneratePart = (part: TPart) => string;
