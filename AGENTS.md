# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a minimal Node.js CLI scaffold, but should follow this target structure as features are added:

```text
bin/
  betterpropmt.js # exe file
src/
  cli.ts            # entrypoint
  commands/
    create.ts
    build.ts
  core/
    logic.ts
    config.ts
tsconfig.json
package.json
```

Keep commands thin. Put real logic inside `core/`.

Current files:

- `package.json`: package metadata and npm scripts.
- `README.md`: high-level project note.
- `index.js`: current CLI scaffold entrypoint.

As the project grows, move runtime code into `src/` and place tests in `test/` for clear separation.

## Build, Test, and Development Commands

There is no build pipeline yet. Use npm commands directly:

- `bun install`: install dependencies.
- `bun run test`: runs the current placeholder test script (intentionally exits with error until real tests are added).

If you add tooling (lint, formatter, test runner), expose it through `package.json` scripts so contributors can run one standard command per task.

**If you make edits to any file go review dependency list and update those files to maintain consistency**

## Coding Style & Naming Conventions

- ALWAYS write unit test before coding, make sure cover edge case. If task more complex create .md file for check list before implement

Use modern JavaScript (CommonJS in this repo today), 2-space indentation, and semicolons.

- Filenames: lowercase (`index.js`, `prompt-parser.js`).
- Functions/variables: `camelCase`.
- Constructors/classes (if introduced): `PascalCase`.

Prefer small, single-purpose modules and explicit exports via `module.exports`.

## Testing Guidelines

No test framework is configured yet. Add tests with one of:

- built-in `bun:test`, or
- a lightweight framework wired through `bun test`.

Recommended conventions:

- Test files: `*.test.ts`.
- Mirror source layout (for future `src/`, use `<module>.test.ts`).
- Cover success path and at least one failure/edge case per module.

## Validate

ALLWAYS run `bunx tsc --noEmit` and run `bun run lint` after finish edit file for check issue and fix them if needed

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
