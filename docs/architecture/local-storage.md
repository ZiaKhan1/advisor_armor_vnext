---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# Local Storage

All local data lives under `app.getPath('userData')`:

- **macOS:** `~/Library/Application Support/<productName>/`
- **Windows:** `%APPDATA%\<productName>\`

## Files

### `storage/user.json`
Written at onboarding completion. Read on every launch to skip the onboarding flow.

```json
{
  "email": "user@example.com",
  "isAdmin": false,
  "companyName": "Acme Corp"
}
```

### `settings.json`
App behaviour config. Written by the app as needed. Keys missing from the file fall back to defaults.

```json
{
  "scanIntervalHours": 24,
  "retryMaxAttempts": 3,
  "retryDelaySeconds": 15,
  "diagnosticLogLevel": "detailed"
}
```

| Key | Default | Description |
|---|---|---|
| `scanIntervalHours` | `24` | Fetched from policy after each policy fetch; drives the scan scheduler |
| `retryMaxAttempts` | `3` | Max result submission attempts before showing failure message |
| `retryDelaySeconds` | `15` | Delay between submission retry attempts |
| `diagnosticLogLevel` | `"detailed"` | Log verbosity — `off`, `minimal`, or `detailed` |

## Behaviour Notes

- `scanIntervalHours` is always written after a successful policy fetch — the file value reflects the last known policy
- `retryMaxAttempts` and `retryDelaySeconds` can be manually edited in `settings.json` to override defaults; the app reads them at runtime
- `diagnosticLogLevel` is configurable at runtime via IPC (no restart required) — see `docs/architecture/logging.md`
- If `settings.json` is missing or malformed, all keys fall back to their defaults
- If `storage/user.json` is missing, the app treats the user as not onboarded and shows the onboarding flow
- v1 does not use a cached policy for offline scans; policy is fetched fresh for each scan
