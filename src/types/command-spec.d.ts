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

type TCommandSpecBase<TOpts> = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  arguments?: TArgumentSpec[];
  errorPrefix?: string;
  helpText?: string;
  spinnerMessage?: string;
  formatText?: (result: unknown, ctx: TCliContext) => unknown;
  validate?: (params: {
    opts: TOpts;
    args: Record<string, unknown>;
    ctx: TCliContext;
  }) => string | undefined;
};

type TCommandSpecWithHandler<TOpts> = TCommandSpecBase<TOpts> & {
  handler: TCommandHandler<TOpts>;
  customAction?: never;
};

type TCommandSpecWithCustomAction<TOpts> = TCommandSpecBase<TOpts> & {
  handler?: never;
  customAction: (command: Command, deps: TCommandFactoryDeps) => void;
};

export type TCommandSpec<TOpts = Record<string, unknown>> =
  | TCommandSpecWithHandler<TOpts>
  | TCommandSpecWithCustomAction<TOpts>;

export type TParentCommandSpec = {
  name: string;
  description: string;
  flags?: Record<string, TFlagSpec>;
  helpText?: string;
  subcommands: Command[];
};
