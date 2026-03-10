import type { Command } from "commander";
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
}) => Promise<unknown>;

type TCommandSpecCore = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  arguments?: TArgumentSpec[];
  helpText?: string;
};

type TCommandSpecWithHandler<TOpts> = TCommandSpecCore & {
  handler: TCommandHandler<TOpts>;
  customAction?: never;
  errorPrefix?: string;
  spinnerMessage?: string;
  formatText?: (result: unknown, ctx: TCliContext) => unknown;
  validate?: (params: {
    opts: TOpts;
    args: Record<string, unknown>;
    ctx: TCliContext;
  }) => string | undefined;
};

type TCommandSpecWithCustomAction = TCommandSpecCore & {
  handler?: never;
  customAction: (command: Command, deps: TCommandFactoryDeps) => void;
};

export type TCommandSpec<TOpts = Record<string, unknown>> =
  | TCommandSpecWithHandler<TOpts>
  | TCommandSpecWithCustomAction;

export type TParentCommandSpec = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  helpText?: string;
  subcommands: Command[];
};
