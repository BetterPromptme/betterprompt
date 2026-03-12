---
globs: src/commands/**/*.ts, src/services/**/*.ts
---

# Error Handling Rules

## Never `process.exit()`

- Always use `setExitCode(code)` from factory deps instead of `process.exit()`.
- `process.exit()` bypasses cleanup and makes testing impossible.

## Standard Handler (Pattern 1)

- The factory catches errors automatically when using `handler`.
- Set `errorPrefix` in the spec to customize error output (e.g., `"X Failed to fetch credits"`).
- Set `spinnerMessage` to get automatic spinner start/stop/fail.
- Do not wrap `handler` in try/catch — the factory does this.

## customAction (Pattern 2)

- You are responsible for your own error handling in `customAction`.
- Wrap the action body in try/catch.
- Handle both `Error` instances and non-Error throws: use `String(error)` for the message.
- Call `deps.error(message)` and `deps.setExitCode(1)` on failure.

## Service Error Patterns

- Throw errors using constants: `throw new Error(SOME_MESSAGES.errorKey)`.
- For file-not-found scenarios, check `error.code === "ENOENT"` and throw a descriptive error.
- Never swallow errors silently — either handle them meaningfully or let them propagate.

## Validation

- Use the `validate` spec field for input validation.
- `validate` is synchronous: return `string` (error message) or `undefined` (valid).
- Validation errors are displayed to the user automatically by the factory — do not throw from `validate`.
