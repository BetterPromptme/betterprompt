import type { Command, OutputConfiguration } from "commander";
import type { TCliContext } from "./context";
import type { TCommandFactoryDeps } from "./command-factory";

export type TFlagSpec = {
  flag: string;
  description: string;
  collect?: (value: string, prev: string[]) => string[];
  default?: unknown;
};

export type TArgumentSpec = {
  name: string;
  description: string;
  parse?: (value: string) => unknown;
};

export type TCommandHandler<TOpts> = (params: {
  opts: TOpts;
  args: Record<string, unknown>;
  ctx: TCliContext;
  command: Command;
  setExitCode: (code: number) => void;
  deps: TCommandFactoryDeps;
}) => Promise<unknown>;

export type TValidateFn<TOpts> = (params: {
  opts: TOpts;
  args: Record<string, unknown>;
  ctx: TCliContext;
}) => string | undefined;

type TCommandSpecCore = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  arguments?: TArgumentSpec[];
  helpText?: string;
  configureOutput?: OutputConfiguration;
  showHelpAfterError?: boolean;
  showSuggestionAfterError?: boolean;
};

type TCommandSpecWithHandler<TOpts> = TCommandSpecCore & {
  handler: TCommandHandler<TOpts>;
  customAction?: never;
  errorPrefix?: string;
  spinnerMessage?: string;
  formatText?: (result: unknown, ctx: TCliContext) => unknown;
  validate?: TValidateFn<TOpts>;
};

type TCommandSpecWithCustomAction = TCommandSpecCore & {
  handler?: never;
  customAction: (command: Command, deps: TCommandFactoryDeps) => void;
};

export type TCommandSpec<TOpts = Record<string, unknown>> =
  | TCommandSpecWithHandler<TOpts>
  | TCommandSpecWithCustomAction;

type TParentCommandSpecCore = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  helpText?: string;
  subcommands: Command[];
  arguments?: TArgumentSpec[];
};

type TParentCommandSpecWithHandler<TOpts> = TParentCommandSpecCore & {
  handler: TCommandHandler<TOpts>;
  formatText?: (result: unknown, ctx: TCliContext) => unknown;
  spinnerMessage?: string;
  errorPrefix?: string;
  validate?: TValidateFn<TOpts>;
};

type TParentCommandSpecWithoutHandler = TParentCommandSpecCore & {
  handler?: never;
  formatText?: never;
  spinnerMessage?: never;
  errorPrefix?: never;
  validate?: never;
};

export type TParentCommandSpec<TOpts = Record<string, unknown>> =
  | TParentCommandSpecWithHandler<TOpts>
  | TParentCommandSpecWithoutHandler;
