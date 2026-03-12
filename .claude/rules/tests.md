---
globs: src/**/*.test.ts
---

# Test Rules

## Framework

- Use `bun:test` exclusively: `describe`, `it`, `expect`, `mock`, `afterEach`, `beforeEach`.
- Do not import from Jest, Vitest, or other test frameworks.

## Command Tests

- Use `createFactoryDeps()` from test helpers to get mock factory deps (spinner, printResult, error, setExitCode).
- Build commands via `createXxxCommand(mockDeps, mockFactoryDeps)` — never test the pre-built `xxxCommand` instance.
- Execute commands via `command.parseAsync(["command-name", ...args], { from: "user" })`.
- Assert on `mockFactoryDeps.printResult` calls for output and `mockFactoryDeps.error` for error paths.

## Service Tests

- Create temp directories via `mkdtemp()` for any file-system tests.
- Inject `getHomeDir` / `configPath` deps pointing to temp dirs.
- Call `resetXxxForTests()` in `afterEach` to clear cached state.

## Cleanup (afterEach)

- Always call `mock.restore()` to reset mocked functions.
- Remove temp directories created during the test.
- Reset any singleton/cached state via the service's reset function.

## Co-location

- Place test files next to their source file in the same directory (e.g., `service.ts` + `service.test.ts`).

## Minimum Coverage

- Success/happy path.
- At least one error/failure path.
- JSON output mode (when the command supports `--json`).
