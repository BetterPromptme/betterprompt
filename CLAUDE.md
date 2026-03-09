# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install           # install dependencies
bun run build         # compile TypeScript → dist/
bun run test          # run all tests
bun test <file>       # run a single test file
bunx tsc --noEmit     # type-check only
bun run lint          # lint (eslint)
bun run lint:fix      # auto-fix lint issues
bun run format        # auto-format (prettier)
```

**After editing any file:** always run `bunx tsc --noEmit` and `bun run lint`, then fix any issues.

**Related files:** When editing a file, always update all related files that depend on or are affected by the change (e.g., tests, constants, types, imports, re-exports). Never leave related files out of sync.

## Architecture

### Layer Responsibilities

| Layer     | Path                                         | Rule                                                           |
| --------- | -------------------------------------------- | -------------------------------------------------------------- |
| Commands  | `src/commands/<cmd>/command.ts`              | CLI wiring only — no business logic                            |
| Services  | `src/services/<domain>/`                     | All business logic lives here                                  |
| Constants | `src/constants/`                             | All CLI surface strings (names, flags, descriptions, messages) |
| Types     | `src/types/` and `commands/<cmd>/types.d.ts` | Type declarations only (no runtime values in `.d.ts`)          |

### Command Structure

Each command is a folder. Subcommands are nested folders.

```
src/commands/generate/
  command.ts       # registers Commander command, calls service
  constants.ts     # command-specific strings
  types.d.ts       # type declarations
src/commands/skill/
  command.ts
  search/command.ts
  install/command.ts
  ...
```

### Constants Convention

Never hardcode command names, flags, or descriptions inline. Declare them in `src/constants/<domain>.ts` and import from `src/constants/index.ts`.

```typescript
export const AUTH_COMMAND = {
  name: "auth",
  description: "...",
  flags: { apiKey: { flag: "--api-key <key>", description: "..." } },
} as const;
```

- `*_COMMAND` → CLI surface (name, description, flags)
- `*_MESSAGES` → user-facing strings (errors, prompts, help text)
- `*_STORAGE` → file/directory names and modes
- `SHARED_FLAGS` (`src/constants/flags.ts`) → flags reused across commands
- `CLI_META` (`src/constants/cli.ts`) → root program metadata and global flags

### Context Resolution

All commands resolve global flags via `getCommandContext(command)` from `src/services/context/service.ts` → returns `TCliContext` (scope, outputFormat, verbosity, registry, yes, color). Pass context through service calls.

### State Layout

Global: `~/.betterprompt/`
Project-local: `<project>/.betterprompt/` (overrides global when both exist)

```
~/.betterprompt/
├── config.json          # global defaults
├── auth.json            # session metadata (secrets in OS keychain)
├── outputs/
│   ├── history.jsonl    # append-only listing index
│   └── <runId>/         # per-run request/response/metadata
├── skills/<skill-slug>/ # SKILL.md, manifest.json, schema.json
├── logs/
└── tmp/
```

## Testing

- Framework: `bun:test`
- Test files: `*.test.ts`, co-located with the source they test
- Only write tests for commands and services
- Write tests before implementation; cover success path + at least one failure/edge case

## Coding Style

- ESM modules, 2-space indent, semicolons
- Filenames: `kebab-case.ts`
- Functions/variables: `camelCase`; Classes: `PascalCase`
- Type declarations: always prefix with `T` (e.g., `TCliContext`, `TScope`, `TGenerateDeps`)
- Prefer small, single-purpose modules with explicit exports

## Commit Style

Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
