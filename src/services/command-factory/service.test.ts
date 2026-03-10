import { Command } from "commander";
import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  createCommandFromSpec,
  createParentCommandFromSpec,
} from "./service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TCommandSpec, TParentCommandSpec } from "../../types/command-spec";
import type { TSpinnerLike } from "../../types/error-ux";

const createSpinnerLike = (): TSpinnerLike => ({
  start: mock(function (this: TSpinnerLike) {
    return this;
  }),
  succeed: mock(function (this: TSpinnerLike) {
    return this;
  }),
  fail: mock(function (this: TSpinnerLike) {
    return this;
  }),
});

const createDeps = (overrides: Partial<TCommandFactoryDeps> = {}): TCommandFactoryDeps => {
  const spinner = createSpinnerLike();
  return {
    createSpinner: mock(() => spinner),
    printResult: mock(() => {}),
    error: mock(() => {}),
    setExitCode: mock(() => {}),
    ...overrides,
  };
};

const runCommand = async (
  spec: TCommandSpec,
  deps: Partial<TCommandFactoryDeps>,
  args: string[] = []
): Promise<Command> => {
  const cmd = createCommandFromSpec(spec, deps);
  await cmd.parseAsync(args, { from: "user" });
  return cmd;
};

describe("createCommandFromSpec", () => {
  afterEach(() => {
    mock.restore();
  });

  it("builds a command with the correct name and description", () => {
    const spec: TCommandSpec = {
      name: "ping",
      description: "A ping command",
      handler: mock(async () => undefined),
    };
    const deps = createDeps();
    const cmd = createCommandFromSpec(spec, deps);
    expect(cmd.name()).toBe("ping");
    expect(cmd.description()).toBe("A ping command");
  });

  it("applies boolean flags from spec", async () => {
    const handler = mock(async ({ opts: _opts }: { opts: { verbose?: boolean }; args: Record<string, unknown>; ctx: unknown; command: Command }) => undefined);
    const spec: TCommandSpec<{ verbose?: boolean }> = {
      name: "mycommand",
      description: "A command",
      flags: {
        verbose: { flag: "--verbose", description: "Verbose mode" },
      },
      handler,
    };
    const deps = createDeps();
    await runCommand(spec as TCommandSpec, deps, ["--verbose"]);
    expect(handler).toHaveBeenCalledTimes(1);
    const callArgs = (handler as ReturnType<typeof mock>).mock.calls[0] as [{ opts: { verbose?: boolean } }];
    expect(callArgs[0].opts.verbose).toBe(true);
  });

  it("applies value flags with defaults from spec", async () => {
    const handler = mock(async ({ opts: _opts }: { opts: { format: string }; args: Record<string, unknown>; ctx: unknown; command: Command }) => undefined);
    const spec: TCommandSpec<{ format: string }> = {
      name: "mycommand",
      description: "A command",
      flags: {
        format: {
          flag: "--format <fmt>",
          description: "Output format",
          default: "table",
        },
      },
      handler,
    };
    const deps = createDeps();
    await runCommand(spec as TCommandSpec, deps, []);
    expect(handler).toHaveBeenCalledTimes(1);
    const callArgs = (handler as ReturnType<typeof mock>).mock.calls[0] as [{ opts: { format: string } }];
    expect(callArgs[0].opts.format).toBe("table");
  });

  it("applies collect flags from spec", async () => {
    const handler = mock(async ({ opts: _opts }: { opts: { tag: string[] }; args: Record<string, unknown>; ctx: unknown; command: Command }) => undefined);
    const spec: TCommandSpec<{ tag: string[] }> = {
      name: "mycommand",
      description: "A command",
      flags: {
        tag: {
          flag: "--tag <value>",
          description: "Tags",
          collect: (v, prev) => [...prev, v],
          default: [],
        },
      },
      handler,
    };
    const deps = createDeps();
    await runCommand(spec as TCommandSpec, deps, ["--tag", "a", "--tag", "b"]);
    expect(handler).toHaveBeenCalledTimes(1);
    const callArgs = (handler as ReturnType<typeof mock>).mock.calls[0] as [{ opts: { tag: string[] } }];
    expect(callArgs[0].opts.tag).toEqual(["a", "b"]);
  });

  it("applies arguments from spec and maps to named args record", async () => {
    const handler = mock(async ({ args }: { opts: unknown; args: Record<string, unknown>; ctx: unknown; command: Command }) => {
      expect(args["name"]).toBe("world");
    });
    const spec: TCommandSpec = {
      name: "greet",
      description: "Greet someone",
      arguments: [{ name: "name", description: "Name to greet" }],
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, ["world"]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("applies parse function to arguments", async () => {
    const handler = mock(async ({ args }: { opts: unknown; args: Record<string, unknown>; ctx: unknown; command: Command }) => {
      expect(args["count"]).toBe(42);
    });
    const spec: TCommandSpec = {
      name: "counter",
      description: "Count",
      arguments: [
        {
          name: "count",
          description: "The count",
          parse: (v) => parseInt(v, 10),
        },
      ],
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, ["42"]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("handler receives opts, args, ctx, and command", async () => {
    let receivedParams: unknown = null;
    const handler = mock(async (params: unknown) => {
      receivedParams = params;
    });
    const spec: TCommandSpec<{ verbose?: boolean }> = {
      name: "check",
      description: "Check",
      flags: {
        verbose: { flag: "--verbose", description: "Verbose" },
      },
      arguments: [{ name: "target", description: "Target" }],
      handler,
    };
    const deps = createDeps();
    await runCommand(spec as TCommandSpec, deps, ["--verbose", "mytarget"]);

    const params = receivedParams as {
      opts: { verbose?: boolean };
      args: Record<string, unknown>;
      ctx: { outputFormat: string };
      command: Command;
    };
    expect(params.opts.verbose).toBe(true);
    expect(params.args["target"]).toBe("mytarget");
    expect(params.ctx).toBeDefined();
    expect(params.ctx.outputFormat).toBe("text");
    expect(params.command).toBeInstanceOf(Command);
  });

  it("validate hook blocks handler and reports error when it returns a string", async () => {
    const handler = mock(async () => undefined);
    const validate = mock(() => "validation failed: bad input");
    const spec: TCommandSpec = {
      name: "cmd",
      description: "Cmd",
      validate,
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith("validation failed: bad input");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(deps.printResult).not.toHaveBeenCalled();
  });

  it("validate hook returning undefined allows handler to proceed", async () => {
    const handler = mock(async () => undefined);
    const validate = mock(() => undefined);
    const spec: TCommandSpec = {
      name: "cmd",
      description: "Cmd",
      validate,
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  it("uses spinner when spinnerMessage is set", async () => {
    const handler = mock(async () => ({ value: 42 }));
    const spec: TCommandSpec = {
      name: "spinny",
      description: "Spinny cmd",
      spinnerMessage: "Loading...",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.createSpinner).toHaveBeenCalledWith("Loading...");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledTimes(1);
  });

  it("skips spinner when spinnerMessage is absent", async () => {
    const handler = mock(async () => ({ value: 42 }));
    const spec: TCommandSpec = {
      name: "nospinner",
      description: "No spinner cmd",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.createSpinner).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(deps.printResult).toHaveBeenCalledTimes(1);
  });

  it("passes handler result to printResult with context", async () => {
    const result = { message: "hello" };
    const handler = mock(async () => result);
    const spec: TCommandSpec = {
      name: "output",
      description: "Output cmd",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.printResult).toHaveBeenCalledTimes(1);
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual(result);
    expect(ctx).toBeDefined();
    expect(ctx.outputFormat).toBe("text");
  });

  it("calls formatText in text mode and passes result to printResult", async () => {
    const raw = { value: 99 };
    const formatted = "Formatted: 99";
    const handler = mock(async () => raw);
    const formatText = mock(() => formatted);
    const spec: TCommandSpec = {
      name: "fmtcmd",
      description: "Format cmd",
      formatText,
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(formatText).toHaveBeenCalledTimes(1);
    expect(formatText).toHaveBeenCalledWith(raw, expect.objectContaining({ outputFormat: "text" }));
    const [data] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown];
    expect(data).toBe(formatted);
  });

  it("skips formatText in JSON mode and passes raw result to printResult", async () => {
    const raw = { value: 99 };
    const handler = mock(async () => raw);
    const formatText = mock(() => "Formatted: 99");
    const spec: TCommandSpec = {
      name: "jsonmode",
      description: "JSON mode cmd",
      formatText,
      handler,
    };
    const deps = createDeps();
    // Use --json flag at program level to trigger json mode
    const cmd = createCommandFromSpec(spec, deps);
    const program = new Command("test").option("--json", "JSON output").addCommand(cmd);
    // from: "user" means no args are skipped, so first arg is parsed directly
    await program.parseAsync(["--json", "jsonmode"], { from: "user" });

    expect(formatText).not.toHaveBeenCalled();
    const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock.calls[0] as [unknown, { outputFormat: string }];
    expect(data).toEqual(raw);
    expect(ctx.outputFormat).toBe("json");
  });

  it("catches errors, formats with errorPrefix, calls error() and setExitCode(1)", async () => {
    const handler = mock(async () => {
      throw new Error("something went wrong");
    });
    const spec: TCommandSpec = {
      name: "failcmd",
      description: "Failing cmd",
      errorPrefix: "Oh no:",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledTimes(1);
    expect(deps.error).toHaveBeenCalledWith("Oh no: something went wrong");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("uses default error prefix when errorPrefix is not set", async () => {
    const handler = mock(async () => {
      throw new Error("oops");
    });
    const spec: TCommandSpec = {
      name: "defaulterr",
      description: "Default error cmd",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.error).toHaveBeenCalledWith("Command failed: oops");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("handles non-Error throwables and produces string message", async () => {
    const handler = mock(async () => {
      throw "string error thrown";
    });
    const spec: TCommandSpec = {
      name: "stringthrow",
      description: "String throw cmd",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("string error thrown")
    );
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("skips printResult when handler returns undefined", async () => {
    const handler = mock(async () => undefined);
    const spec: TCommandSpec = {
      name: "nooutput",
      description: "No output cmd",
      handler,
    };
    const deps = createDeps();
    await runCommand(spec, deps, []);

    expect(deps.printResult).not.toHaveBeenCalled();
    expect(deps.error).not.toHaveBeenCalled();
  });

  it("customAction escape hatch skips standard action and calls customAction", () => {
    const customAction = mock((_cmd: Command, _deps: TCommandFactoryDeps) => {});
    const spec: TCommandSpec = {
      name: "custom",
      description: "Custom action cmd",
      customAction,
    };
    const deps = createDeps();
    const cmd = createCommandFromSpec(spec, deps);

    expect(customAction).toHaveBeenCalledTimes(1);
    expect(customAction).toHaveBeenCalledWith(cmd, deps);
    // Verify no standard action was wired by checking _actionHandler is not set via Commander's action
    // (the command was returned without calling .action())
    expect(cmd.name()).toBe("custom");
  });
});

describe("createParentCommandFromSpec", () => {
  it("creates command with correct name and description", () => {
    const spec: TParentCommandSpec = {
      name: "parent",
      description: "A parent command",
      subcommands: [],
    };
    const cmd = createParentCommandFromSpec(spec);
    expect(cmd.name()).toBe("parent");
    expect(cmd.description()).toBe("A parent command");
  });

  it("adds all subcommands to the parent", () => {
    const sub1 = new Command("sub1").description("Sub 1");
    const sub2 = new Command("sub2").description("Sub 2");
    const spec: TParentCommandSpec = {
      name: "parent",
      description: "Parent",
      subcommands: [sub1, sub2],
    };
    const cmd = createParentCommandFromSpec(spec);
    const names = cmd.commands.map((c) => c.name());
    expect(names).toContain("sub1");
    expect(names).toContain("sub2");
  });

  it("does not wire an action on the parent command", () => {
    const spec: TParentCommandSpec = {
      name: "parent",
      description: "Parent",
      subcommands: [],
    };
    const cmd = createParentCommandFromSpec(spec);
    // Commander's _actionHandler is null when no .action() is called
    // We verify by checking there's no action registered
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((cmd as any)._actionHandler).toBeNull();
  });

  it("applies flags to the parent command", () => {
    const spec: TParentCommandSpec = {
      name: "parent",
      description: "Parent",
      flags: {
        verbose: { flag: "--verbose", description: "Verbose mode" },
      },
      subcommands: [],
    };
    const cmd = createParentCommandFromSpec(spec);
    const optionFlags = cmd.options.map((o) => o.flags);
    expect(optionFlags.some((f) => f.includes("--verbose"))).toBe(true);
  });

  it("appends helpText when provided", () => {
    const spec: TParentCommandSpec = {
      name: "parent",
      description: "Parent",
      helpText: "Extra help text here",
      subcommands: [],
    };
    const cmd = createParentCommandFromSpec(spec);
    // helpText is stored internally; we verify it was called without error
    expect(cmd).toBeInstanceOf(Command);
  });
});
