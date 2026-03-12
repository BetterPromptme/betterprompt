---
globs: src/constants/*.ts
---

# Constants Rules

## Naming Conventions

- `*_COMMAND` — command/subcommand metadata: `name`, `description`, `flags`.
- `*_MESSAGES` — user-facing strings: help text, error messages, prompts.
- `*_STORAGE` — file/directory names and permission modes.
- `SHARED_FLAGS` — flags reused across multiple commands (in `flags.ts`).
- `CLI_META` — root program metadata and global flags (in `cli.ts`).

## Shape

- All constant objects must use `as const` for literal type inference.
- Subcommand constants are nested inside the parent's `*_COMMAND.subcommands` or declared separately in the command's own `constants.ts`.
- Flag specs follow the shape: `{ flag: string; description: string }`.

## Re-export

- Every new constants file must be re-exported from `src/constants/index.ts`.
- Use named exports, never default exports.

## No Runtime Logic

- Constants files contain only declarations (`export const`).
- Never import from services or other runtime modules.
- No function calls, no computed values at module scope.
