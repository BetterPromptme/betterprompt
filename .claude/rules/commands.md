---
globs: src/commands/**/command.ts
---

# Command Wiring Rules

## Factory Pattern (mandatory)

- Use `createCommandFromSpec` for leaf commands (no subcommands).
- Use `createParentCommandFromSpec` for commands with subcommands.
- Never instantiate `new Command()` directly in command files.

## Export Convention

- **Top-level commands** export both a factory function and a pre-built instance:
  ```ts
  export const createXxxCommand = (deps = defaultDeps, factoryDeps?) => ...;
  export const xxxCommand = createXxxCommand();
  ```
- **Subcommands** export only the factory function: `export const createXxxSubcommand = (deps, factoryDeps?) => ...;`

## Dependency Injection

- Define a typed `defaultDeps` object with all service dependencies.
- Always accept `factoryDeps?: Partial<TCommandFactoryDeps>` as the second parameter.
- Import `TCommandFactoryDeps` from `src/types/command-factory.d.ts`.

## Constants Only

- All command names, descriptions, and flag definitions must come from `src/constants/`.
- Never hardcode CLI surface strings (names, descriptions, flag specs) inline.

## Thin Wiring

- Commands are wiring-only: they connect CLI flags to service calls.
- All business logic lives in `src/services/`. Do not put logic in command files.

## handler vs customAction

- Prefer `handler` (Pattern 1) — the factory manages spinner, error catching, and output.
- Use `customAction` only when you need full Commander control (interactive prompts, manual spinner lifecycle, complex flag inheritance).
- Never mix both in the same spec.
