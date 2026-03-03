import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { createProgram } from "../cli";

type TScope =
  | { type: "global" }
  | { type: "project" }
  | { type: "dir"; path: string };

type TExpectedCliContext = {
  scope: TScope;
  outputFormat: "text" | "json";
  verbosity: "normal" | "quiet" | "verbose";
  registry?: string;
  yes: boolean;
  color: boolean;
};

type TResolveContext = (flags: Record<string, unknown>) => TExpectedCliContext;
type TGetCommandContext = (command: Command) => TExpectedCliContext;

const parseGlobalFlags = async (argv: string[]): Promise<Record<string, unknown>> => {
  const program = createProgram();
  program.exitOverride();
  const probeCommandName = "context-probe";
  const probeCommand = new Command(probeCommandName).action(() => {});
  program.addCommand(probeCommand);
  await program.parseAsync(["node", "betterprompt", ...argv, probeCommandName], {
    from: "node",
  });
  return program.opts<Record<string, unknown>>();
};

const loadResolveContext = async (): Promise<TResolveContext> => {
  const contextModulePath: string = "./context";
  const contextModule: unknown = await import(contextModulePath);

  if (
    typeof contextModule !== "object" ||
    contextModule === null ||
    !("resolveContext" in contextModule)
  ) {
    throw new Error("resolveContext export was not found in src/core/context.ts");
  }

  const resolveContext = (contextModule as { resolveContext: unknown }).resolveContext;
  if (typeof resolveContext !== "function") {
    throw new Error("resolveContext must be a function");
  }

  return resolveContext as TResolveContext;
};

const loadGetCommandContext = async (): Promise<TGetCommandContext> => {
  const contextModulePath: string = "./context";
  const contextModule: unknown = await import(contextModulePath);

  if (
    typeof contextModule !== "object" ||
    contextModule === null ||
    !("getCommandContext" in contextModule)
  ) {
    throw new Error("getCommandContext export was not found in src/core/context.ts");
  }

  const getCommandContext = (contextModule as { getCommandContext: unknown }).getCommandContext;
  if (typeof getCommandContext !== "function") {
    throw new Error("getCommandContext must be a function");
  }

  return getCommandContext as TGetCommandContext;
};

describe("resolveContext", () => {
  it("uses default values when no global flags are provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags([]);

    expect(resolveContext(flags)).toEqual({
      scope: { type: "global" },
      outputFormat: "text",
      verbosity: "normal",
      yes: false,
      color: true,
    });
  });

  it("sets scope to project when --project is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--project"]);

    expect(resolveContext(flags).scope).toEqual({ type: "project" });
  });

  it("sets scope to global when --global is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--global"]);

    expect(resolveContext(flags).scope).toEqual({ type: "global" });
  });

  it("uses dir scope when --dir is provided and overrides scope flags", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags([
      "--project",
      "--global",
      "--dir",
      "/tmp/custom-scope",
    ]);

    expect(resolveContext(flags).scope).toEqual({
      type: "dir",
      path: "/tmp/custom-scope",
    });
  });

  it("sets output format to json when --json is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--json"]);

    expect(resolveContext(flags).outputFormat).toBe("json");
  });

  it("sets verbosity to quiet when --quiet is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--quiet"]);

    expect(resolveContext(flags).verbosity).toBe("quiet");
  });

  it("sets verbosity to verbose when --verbose is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--verbose"]);

    expect(resolveContext(flags).verbosity).toBe("verbose");
  });

  it("sets registry override when --registry is provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags([
      "--registry",
      "https://registry.example.test",
    ]);

    expect(resolveContext(flags).registry).toBe("https://registry.example.test");
  });

  it("sets non-interactive confirmation with --yes", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--yes"]);

    expect(resolveContext(flags).yes).toBe(true);
  });

  it("disables color output with --no-color", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--no-color"]);

    expect(resolveContext(flags).color).toBe(false);
  });

  it("throws when --project and --global are both provided", async () => {
    const resolveContext = await loadResolveContext();
    const flags = await parseGlobalFlags(["--project", "--global"]);

    expect(() => resolveContext(flags)).toThrow(
      "Cannot use --project and --global together"
    );
  });

  it("reads resolved context from an action command with inherited global flags", async () => {
    const getCommandContext = await loadGetCommandContext();

    const program = createProgram();
    program.exitOverride();

    let capturedContext: TExpectedCliContext | undefined;

    const inspectCommand = new Command("inspect").action((_opts, command) => {
      capturedContext = getCommandContext(command);
    });

    program.addCommand(inspectCommand);
    await program.parseAsync(
      [
        "node",
        "betterprompt",
        "--project",
        "--json",
        "--verbose",
        "--yes",
        "--registry",
        "https://registry.example.test",
        "inspect",
      ],
      { from: "node" }
    );

    expect(capturedContext).toEqual({
      scope: { type: "project" },
      outputFormat: "json",
      verbosity: "verbose",
      registry: "https://registry.example.test",
      yes: true,
      color: true,
    });
  });
});
