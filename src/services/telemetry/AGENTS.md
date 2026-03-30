# Telemetry Service

Anonymous, fire-and-forget CLI usage tracking. Sends a GET request to `/t/cli` with event data as query params. No auth required, no PII collected.

## Key Files

- `service.ts` — `track()` (fire-and-forget event sender), `isEnabled()` (opt-out check), `isCommandEnabled()` (per-command allowlist), `buildMetadata()` (whitelist-filtered metadata builder), `getErrorType()` (classifies errors as `api_error`, `timeout_error`, or `unknown_error`), `extractErrorData()` (extracts `details.data` from `ApiError` instances), session ID management
- `service.test.ts` — Unit tests for enable/disable logic, metadata filtering, query param construction, error type classification, error data extraction

## Patterns

- Uses raw `fetch`, not `ApiClient` (no auth needed, no retry wanted)
- `track()` is synchronous (returns void), fires fetch in background with `.catch(() => {})`
- Session ID is a lazy singleton per process (`crypto.randomBytes`)
- Opt-out via `DISABLE_TELEMETRY=1`, `DO_NOT_TRACK=1` env vars, `config.telemetry === false`, or `config.telemetry.enabled === false`
- Per-command filtering via `config.telemetry.commands` array (only track listed commands)
- 3-second AbortController timeout on fetch
- All dependencies injectable via `TTelemetryDependencies` for testing
- Metadata is whitelist-filtered per command using `TELEMETRY_WHITELIST` from constants
- Platform fields (`os`, `arch`, `isCi`) and `durationMs` are added automatically
- Query strings truncated to 200 chars (`TELEMETRY_CONFIG.maxQueryLength`)
- `success` defaults to `true` when not explicitly provided

## Event Shape (v2)

- `TTelemetryEvent` = `{ command, startedAt, metadata? }`
- Query params: `e` (command), `v` (CLI version), `sid` (session ID), `m` (JSON metadata)
- 21 tracked commands defined in `TELEMETRY_COMMANDS`

## Integration

`track()` can be invoked two ways:

1. **Declarative (preferred):** Add a `telemetry` field to the command spec (`TTelemetrySpec`). The command factory (`wireAction`) calls `track()` automatically on success and error, including `errorType`/`errorData` on failures.
2. **Manual (escape hatch):** Call `track()` with `void` prefix directly in `customAction` handlers or other non-factory code.

Telemetry is a cross-cutting concern, not part of core business logic.
