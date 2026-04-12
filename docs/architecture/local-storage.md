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
  "diagnosticLogLevel": "detailed"
}
```

| Key                  | Default      | Description                                                            |
| -------------------- | ------------ | ---------------------------------------------------------------------- |
| `scanIntervalHours`  | `24`         | Fetched from policy after each policy fetch; drives the scan scheduler |
| `diagnosticLogLevel` | `"detailed"` | Log verbosity — `off`, `minimal`, or `detailed`                        |

### `storage/last-scan.json`

Written after a successful completed scan. Used only for lightweight last-scan metadata in v1.

```json
{
  "completedAt": "2026-04-08T10:15:30.000Z",
  "durationMs": 8810,
  "overallStatus": "PASS"
}
```

| Key             | Type   | Description                                                     |
| --------------- | ------ | --------------------------------------------------------------- |
| `completedAt`   | string | ISO timestamp for the last successful completed scan            |
| `durationMs`    | number | Total scan duration in milliseconds                             |
| `overallStatus` | string | Overall evaluated status for the last successful completed scan |

## Behaviour Notes

- `scanIntervalHours` is always written after a successful policy fetch — the file value reflects the last known policy
- `diagnosticLogLevel` is stored in `settings.json`, but runtime log-level switching is not implemented yet — see `docs/architecture/logging.md`
- `storage/last-scan.json` stores only minimal metadata for the latest successful completed scan
- v1 does not persist full scan results, normalized policy snapshots, device snapshots, or raw command output in `storage/last-scan.json`
- If `settings.json` is missing or malformed, all keys fall back to their defaults
- If `storage/user.json` is missing, the app treats the user as not onboarded and shows the onboarding flow
- If `storage/last-scan.json` is missing, the app simply has no prior scan metadata to display
- Logging out clears both `storage/user.json` and `storage/last-scan.json`, but keeps `settings.json`
- v1 does not use a cached policy for offline scans; policy is fetched fresh for each scan
- Backend timeout and result-submission retry settings are defined in `src/config.ts`, not in `settings.json`
