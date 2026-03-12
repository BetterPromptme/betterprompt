---
globs: src/types/*.d.ts, src/commands/**/types.d.ts
---

# Type Declaration Rules

## T-Prefix Convention

- All type aliases must start with `T`: `TCommandSpec`, `TCliContext`, `TGenerateOpts`.
- Interfaces may omit the prefix only if they represent a class contract (rare in this codebase).

## No Runtime Values

- `.d.ts` files use `export type` and `export interface` only.
- Never declare `const`, `let`, `function`, or `class` in `.d.ts` files.
- Never import runtime modules — only import other types.

## Command-Local Types

- Each command folder may have a `types.d.ts` for command-specific option types (e.g., `TGenerateOpts`).
- These files may re-export from global types in `src/types/` when needed.

## Dependency Types

- Define `TXxxDependencies` for each service's injectable interface.
- Deps types list the functions/values the service requires, enabling test injection.
- Keep deps types in the relevant `src/types/` file or co-located `types.d.ts`.
