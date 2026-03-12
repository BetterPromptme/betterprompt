# Repository Guidelines

## Project Structure & Module Organization

This repository is a Bun + TypeScript CLI. Structure:

```text
bin/
  betterprompt.js # executable entry
src/
  cli.ts
  cli/
    help.ts
  commands/
    generate/
      command.ts
      constants.ts
      types.d.ts
    skill/
      command.ts
      constants.ts
      types.d.ts
      info/
      install/
      uninstall/
      list/
      update/
      search/
    outputs/
      command.ts
      constants.ts
      types.d.ts
      list/
      get/
    config/
      command.ts
      constants.ts
      types.d.ts
      get/
      set/
      unset/
    auth/
    credits/
    doctor/
    reset/
    resources/
    search/
    update/
    whoami/
  services/
    command-factory/  # factory functions for command wiring
    api/
    auth/
    config/
    context/
    doctor/
    generate/
    outputs/
    resources/
    skills/
    run/
    scope/
    bootstrap/
    error-ux/
    output/
    persistence/
    logger/
    reset/
    update/
  types/
    command-factory.d.ts
    command-spec.d.ts
    context.d.ts
    error-ux.d.ts
    *.d.ts
tsconfig.json
package.json
```

Architecture rules:

- **All commands use the command factory pattern** (see Command Factory section below).
- Commands stay thin and only handle CLI wiring.
- Business logic lives in root `src/services/`.
- Every command/subcommand uses a folder.
- Use `types.d.ts` for type declarations (no runtime values in `.d.ts`).
- **All command names, subcommand names, flags, and descriptions MUST be declared in constants.** Never hardcode these strings inline in command wiring or service logic. This keeps the CLI surface controllable, easy to maintain, and scalable.

## Command Factory Pattern

All commands are built using factory functions from `src/services/command-factory/service.ts`. **Do NOT create commands by manually instantiating `new Command()` in command files.** Always use `createCommandFromSpec` or `createParentCommandFromSpec`.

### Core Factory Functions

- **`createCommandFromSpec<TOpts>(spec, factoryDeps?)`** — for leaf commands (no subcommands).
- **`createParentCommandFromSpec<TOpts>(spec, factoryDeps?)`** — for commands with subcommands (e.g. `skill`, `config`, `outputs`).

### Factory Dependencies (`TCommandFactoryDeps`)

```typescript
type TCommandFactoryDeps = {
  createSpinner: TSpinnerFactory;
  printResult: (data: unknown, ctx: TCliContext) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};
```

Default deps are created by `createDefaultCommandFactoryDeps()` in `src/services/command-factory/deps.ts`. Commands accept optional `factoryDeps?: Partial<TCommandFactoryDeps>` for test injection.

### Command Spec Patterns

**Pattern 1 — Standard handler** (most commands): Declare `handler`, `spinnerMessage`, `errorPrefix`, `validate`, and `formatText` in the spec. The factory handles spinner lifecycle, validation, error catching, and output formatting.

```typescript
export const createCreditsCommand = (
  deps = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: CREDITS_COMMAND.name,
      description: CREDITS_COMMAND.description,
      flags: CREDITS_COMMAND.flags,
      spinnerMessage: "Fetching credits balance...",
      errorPrefix: `${logSymbols.error} ${CREDITS_MESSAGES.failedPrefix}`,
      handler: () => deps.getCredits(),
      formatText: (result) => formatCreditsText(result as TCreditBalance),
    },
    factoryDeps
  );
```

**Pattern 2 — `customAction`** (escape hatch): For commands that need full Commander control (interactive flows, complex flag inheritance). The factory wires flags/args/help but delegates action registration to the command.

```typescript
createCommandFromSpec<TAuthOpts>(
  {
    name: AUTH_COMMAND.name,
    description: AUTH_COMMAND.description,
    customAction: (cmd, deps) => {
      cmd.action(async (opts, command) => {
        /* full control */
      });
    },
  },
  factoryDeps
);
```

**Pattern 3 — Parent command** (with subcommands): Uses `createParentCommandFromSpec`. Optionally has its own `handler` (e.g. `outputs` delegates to `get` when called directly).

```typescript
export const createSkillCommand = (deps, factoryDeps?) =>
  createParentCommandFromSpec(
    {
      name: SKILLS_COMMAND.name,
      description: SKILLS_COMMAND.description,
      subcommands: [
        createSkillInfoSubcommand(deps, factoryDeps),
        createSkillInstallSubcommand(deps, factoryDeps),
        // ...
      ],
    },
    factoryDeps
  );
```

### Export Convention

Every command file MUST export:

1. **`createXxxCommand(deps, factoryDeps?)`** — factory function for test injection.
2. **`xxxCommand`** — pre-built instance using default deps (`createXxxCommand()`).

```typescript
export const createCreditsCommand = (deps = defaultDeps, factoryDeps?) => /* ... */;
export const creditsCommand = createCreditsCommand();
```

### Spec Fields Reference

| Field                      | Type                        | Required                               | Description                                              |
| -------------------------- | --------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `name`                     | `string`                    | Yes                                    | Command name from constants                              |
| `description`              | `string`                    | Yes                                    | Command description from constants                       |
| `flags`                    | `Record<string, TFlagSpec>` | No                                     | Flag definitions from constants                          |
| `arguments`                | `TArgumentSpec[]`           | No                                     | Positional argument definitions                          |
| `helpText`                 | `string`                    | No                                     | Additional help text shown after default help            |
| `handler`                  | `TCommandHandler<TOpts>`    | Mutually exclusive with `customAction` | Async handler; factory manages spinner + error catch     |
| `customAction`             | `(cmd, deps) => void`       | Mutually exclusive with `handler`      | Escape hatch for full Commander control                  |
| `spinnerMessage`           | `string`                    | No                                     | If set, factory wraps handler in spinner                 |
| `errorPrefix`              | `string`                    | No                                     | Prefix for error messages (default: `"Command failed:"`) |
| `validate`                 | `TValidateFn<TOpts>`        | No                                     | Sync validation; return error string or `undefined`      |
| `formatText`               | `(result, ctx) => unknown`  | No                                     | Transform result for text output (skipped in JSON mode)  |
| `configureOutput`          | `OutputConfiguration`       | No                                     | Commander output configuration                           |
| `showHelpAfterError`       | `boolean`                   | No                                     | Show help on error                                       |
| `showSuggestionAfterError` | `boolean`                   | No                                     | Show did-you-mean suggestions                            |

### Constants convention

Shared/global constants live in `src/constants/` (one file per domain, re-exported via `src/constants/index.ts`). Each constant file exports `as const` objects following this shape:

```typescript
// src/constants/auth.ts
export const AUTH_COMMAND = {
  name: "auth",
  description: "Authenticate BetterPrompt CLI with your API key",
  flags: {
    apiKey: {
      flag: "--api-key <key>",
      description: "API key for non-interactive auth",
    },
  },
} as const;
```

Key rules:

- `*_COMMAND` objects hold `name`, `description`, and `flags` for each command/subcommand.
- `*_MESSAGES` objects hold user-facing strings (help text, errors, prompts).
- `*_STORAGE` objects hold file/directory names and modes.
- `SHARED_FLAGS` in `src/constants/flags.ts` holds flags reused across multiple commands (e.g. `--json`).
- `CLI_META` in `src/constants/cli.ts` holds root program metadata and global flags.
- When a command has subcommands, declare each subcommand's constant in the same domain file or in its own `constants.ts` inside the command folder.
- Commands import these constants and pass them to Commander; they never define names/flags/descriptions inline.

Current files:

- `package.json`: package metadata and npm scripts.
- `README.md`: CLI usage and behavior docs.
- `install.sh`: standalone binary installer (macOS/Linux) via GitHub Releases.
- `specs/DIRECTORY-LAYOUT.md`: canonical `~/.betterprompt` and project-local directory layout spec.

## `~/.betterprompt` Directory Layout

The canonical layout lives in `specs/DIRECTORY-LAYOUT.md`. Key points:

```text
~/.betterprompt/
├── config.json          # global defaults (registry, output format, cache TTL, telemetry)
├── auth.json            # session metadata; secrets stored in OS keychain
├── outputs/
│   ├── history.jsonl    # append-only index for fast CLI listing
│   └── <runId>/         # per-run request/response/metadata + assets
├── skills/
│   └── <skill-slug>/    # SKILL.md, manifest.json, schema.json per skill
├── logs/                # cli.log, auth.log, errors.log
└── tmp/                 # transient; safe to clear
```

Project-local counterpart (`<project>/.betterprompt/`) mirrors `skills/`, `outputs/`, `logs/`, and `tmp/`. Project-local overrides global when both exist.

## Build, Test, and Development Commands

Use Bun commands:

- `bun install`: install dependencies.
- `bun run test`: run test suite.
- `bun run build`: build CLI into `dist/`.
- `bunx tsc --noEmit`: type-check without emit.
- `bun run lint`: lint codebase.

If you add tooling (lint, formatter, test runner), expose it through `package.json` scripts so contributors can run one standard command per task.

**If you make edits to any file go review dependency list and update those files to maintain consistency**

## Coding Style & Naming Conventions

- ALWAYS write unit test before coding, make sure cover edge case. If task more complex create .md file for check list before implement

Use modern JavaScript (ESM in this repo today), 2-space indentation, and semicolons.

- Filenames: lowercase (`index.js`, `prompt-parser.js`).
- Functions/variables: `camelCase`.
- Constructors/classes (if introduced): `PascalCase`.

Prefer small, single-purpose modules and explicit ESM exports.

## Testing Guidelines

Test framework is `bun:test`.

Recommended conventions:

- Test files: `*.test.ts`.
- Mirror source layout (co-locate tests by command/service domain).
- Cover success path and at least one failure/edge case per module.
- Only write test for command and service

## Validate

ALWAYS run `bunx tsc --noEmit` and run `bun run lint` after finish edit file for check issue and fix them if needed

## Commit & Pull Request Guidelines

Each commit should touch only one file (or one logical file group like a source file + its test). Do not bundle unrelated file changes into a single commit.

Recent history includes `chore:` prefixes and merge commits. Follow concise, imperative commit messages; Conventional Commit style is preferred:

- `feat: add prompt validator`
- `fix: handle empty input`
- `chore: update gitignore`

For pull requests, include:

- clear summary of behavior changes,
- linked issue (if available),
- test evidence (command + result),
- notes on follow-up work for unfinished areas.
