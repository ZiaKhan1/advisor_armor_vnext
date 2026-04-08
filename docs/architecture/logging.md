---
status: active
audience: both
created: 2026-04-06
---

# Logging

## Tool
- **winston** — main process logger
- **winston-daily-rotate-file** — log rotation
- winston runs in main process only; renderer sends log calls via IPC to main

## Log File
- Location: `app.getPath('userData')` — correct Electron platform path per OS
- Naming: `application-{YYYY-MM-DD}.log`, dev files prefixed with `dev-`
- Format per line: `{timestamp} {level}: {message}` — timestamp as `YYYY-MM-DD HH:mm:ss`
- Structured data (scan results, API calls) logged as JSON objects, not strings

## Rotation
- Tool: `winston-daily-rotate-file`
- Max file size: 1MB
- Retention: 2 days in dev, **7 days in production** (3 days is too short for a compliance app — issues reported days later would have no logs)
- Old files zipped/archived

## Log Levels
Standard winston levels: `error`, `warn`, `info`, `verbose`, `debug`, `silly`

Configurable via `diagnosticLogLevel` setting:
| Value | Levels enabled |
|---|---|
| `off` | No logging |
| `minimal` | error + warn only |
| `detailed` | All levels (default) |

- Log level is configurable at **runtime via IPC** (no restart required)
- Changes take effect immediately

## Dev vs Production
- **Dev:** console transport enabled with colour-coded output per level + file transport. Log files prefixed with `dev-`
- **Production:** file transport only, no console output

## What to Log
- Scan start and completion (with per-element results as structured JSON)
- Policy fetch — success/failure, HTTP status, duration
- Result submission — attempt number, success/failure, HTTP status, duration
- Auto-update events — update found, download started, install triggered
- App lifecycle — startup, scan scheduled, shutdown
- All errors and exceptions
- Full raw policy response body on successful policy fetch
- Full response bodies for `validateEmail`, `checkAccess`, `validateCode`, and `sendScanResult` only on error
- Email values may be logged when needed for diagnostics
- Verification codes must not be logged on success; they may be logged on `validateCode` errors only

## Security
- No special masking is required for email in v1 logs
- Verification codes should be treated as sensitive and omitted from normal success logs
- No sensitive device data logged beyond what is needed for diagnostics

## Other Patterns
- Logger stored as `global.log` to prevent duplicate instances
- Wrapper supports multiple arguments and serialises objects as JSON
- Error handling on logger initialisation — if `app.getPath('userData')` fails, log the failure explicitly rather than silently falling back to `__dirname`
- Use native `Date` or `date-fns` for date formatting — **not moment.js** (legacy, unmaintained)
- All imports use ES module `import` syntax — no `require()` mixed in
- Backend error logs should distinguish between `http`, `timeout`, `network`, `application`, and `unknown` categories

## Not Implemented in v1
- `getLogFile()` helper — may be added later if a log export feature is needed in the UI
