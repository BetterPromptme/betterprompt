# Repository Guidelines

## Project Structure & Module Organization

This repository is a Bun + TypeScript CLI. Use this refactor target structure:

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
    auth/
    config/
    credits/
    doctor/
    reset/
    search/
    update/
    whoami/
  services/
    api/
    auth/
    config/
    generate/
    outputs/
    skills/
    run/
    scope/
    bootstrap/
    error-ux/
    output/
    persistence/
    logger/
  types/
    *.d.ts
tsconfig.json
package.json
```

Architecture rules:

- Commands stay thin and only handle CLI wiring.
- Business logic lives in root `src/services/`.
- Every command/subcommand uses a folder.
- Use `types.d.ts` for type declarations (no runtime values in `.d.ts`).
- **All command names, subcommand names, flags, and descriptions MUST be declared in constants.** Never hardcode these strings inline in command wiring or service logic. This keeps the CLI surface controllable, easy to maintain, and scalable.

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
- `specs/DIRECTORY-LAYOUT.md`: canonical `~/.betterprompt` and project-local directory layout spec.
- `tasks/refactor/refactor-commands-services-structure.md`: refactor architecture plan.
- `tasks/refactor/TASKS.json`: refactor execution order and dependencies.

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

Recent history includes `chore:` prefixes and merge commits. Follow concise, imperative commit messages; Conventional Commit style is preferred:

- `feat: add prompt validator`
- `fix: handle empty input`
- `chore: update gitignore`

For pull requests, include:

- clear summary of behavior changes,
- linked issue (if available),
- test evidence (command + result),
- notes on follow-up work for unfinished areas.
