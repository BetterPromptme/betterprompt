# Telemetry Service

Anonymous, fire-and-forget CLI usage tracking. Sends a GET request to `/v1/t` with event data as query params. No auth required, no PII collected.

## Key Files

- `service.ts` — `track()` (fire-and-forget event sender), `isEnabled()` (opt-out check), session ID management
- `service.test.ts` — Unit tests for enable/disable logic and query param construction

## Patterns

- Uses raw `fetch`, not `ApiClient` (no auth needed, no retry wanted)
- `track()` is synchronous (returns void), fires fetch in background with `.catch(() => {})`
- Session ID is a lazy singleton per process (`crypto.randomBytes`)
- Opt-out via `DISABLE_TELEMETRY=1`, `DO_NOT_TRACK=1` env vars, or `config.telemetry === false`
- 3-second AbortController timeout on fetch
- All dependencies injectable via `TTelemetryDependencies` for testing

## Integration

`track()` is called with `void` prefix in command files (generate, skill install/uninstall/search, search). It is a cross-cutting concern, not part of core business logic.
