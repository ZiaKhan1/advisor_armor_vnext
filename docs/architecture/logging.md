---
status: active
audience: both
created: 2026-04-06
---

# Logging

## Tool
- **electron-log** — primary logger
- `electron-log/main` is initialized in the main process and writes to Electron's standard per-app log location
- Renderer logging may be bridged later if needed, but the current implementation logs from the main process only

## Log File
- Location: electron-log default platform path for the app name:
  - macOS: `~/Library/Logs/<productName>/main.log`
  - Windows: `%USERPROFILE%\\AppData\\Roaming\\<productName>\\logs\\main.log`
- Naming and file placement use electron-log defaults unless explicitly overridden later
- Console and file transports are both enabled in the current implementation
- Structured metadata may be passed as objects from the logging wrapper

## Retention
- The current implementation does not configure custom rotation or retention
- If retention rules become a support requirement, configure electron-log's file transport or add an explicit cleanup/export policy later

## Log Levels
Supported by electron-log: `error`, `warn`, `info`, `verbose`, `debug`, `silly`

Configurable via `diagnosticLogLevel` setting:
| Value | Levels enabled |
|---|---|
| `off` | No logging |
| `minimal` | error + warn only |
| `detailed` | All levels (default) |

- The current implementation sets both file and console transports to `info`
- Runtime level switching via settings is planned but not implemented yet

## Dev vs Production
- **Current implementation:** file and console transports are both enabled at `info`
- Production-specific transport differences can be added later if needed

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
- Logger is initialized once in the main process via `electron-log/main`
- A small local wrapper exports the logging methods used by the app
- All imports use ES module `import` syntax — no `require()` mixed in
- Backend error logs should distinguish between `http`, `timeout`, `network`, `application`, and `unknown` categories

## Not Implemented in v1
- `getLogFile()` helper — may be added later if a log export feature is needed in the UI
- Custom rotation/retention rules
- Runtime log-level switching from `diagnosticLogLevel`
- Renderer-to-main log forwarding API
