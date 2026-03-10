import { mock } from "bun:test";
import type { TCommandFactoryDeps } from "../../types/command-factory";

/**
 * Shared test helper for commands built with createCommandFromSpec.
 *
 * Returns a Partial<TCommandFactoryDeps> with all I/O side-effects replaced by
 * no-op mocks, so tests can assert on calls (e.g. error, setExitCode) without
 * touching the real spinner, stdout, or process.exitCode.
 *
 * Pass `overrides` to replace individual deps for a specific test case:
 *
 *   const factory = createFactoryDeps({ error: mock(() => { throw new Error() }) });
 */
export const createFactoryDeps = (
  overrides: Partial<TCommandFactoryDeps> = {}
): Partial<TCommandFactoryDeps> => ({
  // Chainable spinner stub: start/succeed/fail all return the same object.
  createSpinner: mock(() => {
    const s = { start: mock(() => s), succeed: mock(() => s), fail: mock(() => s) };
    return s;
  }),
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});
