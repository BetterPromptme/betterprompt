---
globs: src/services/**/{service,installer,client,parsers,presenters}.ts
---

# Service Module Rules

## Pure Functions with DI

- Accept dependencies as typed parameters, not module-level globals.
- Define a `TXxxDependencies` type for injectable interfaces.
- Provide `defaultDeps` with production implementations.

## Async-Only File I/O

- Use `node:fs/promises` for all file operations. Never use sync fs methods (`readFileSync`, `writeFileSync`, etc.).
- Await all fs calls properly.

## Atomic Writes

- Use the temp-file + rename pattern for writing files:
  1. Write to a temporary file in the same directory.
  2. Rename (atomic move) to the target path.
  3. Clean up the temp file on failure in a `finally` block.

## Caching

- Use promise-based caching: store the Promise itself, not the resolved value. This prevents thundering-herd / duplicate-request issues.
- Export a `resetXxxForTests()` function that clears the cached promise, so tests can start clean.

## Error Handling

- Throw errors using constant messages: `throw new Error(SOME_MESSAGES.someError)`.
- Never use inline error message strings.
- Never call `process.exit()` — let errors propagate to the command layer.

## No Side Effects at Import Time

- Do not execute logic at module scope. All work happens inside exported functions.
