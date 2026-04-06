---
status: active
audience: both
created: 2026-04-05
---

# API Contract

## Policy Fetch

**Request:** TBD (endpoint, method, auth headers)
**Input:** User email
**Output:** JSON with `AppPolicy` and `systemPolicy`

### Response Structure

```json
{
  "AppPolicy": {
    "companyName": "",
    "macPolicy": {
      "prohibitedApps": [
        { "AppName": "AppName or path" }
      ],
      "requiredAppsCategories": [
        {
          "apps": [
            { "AppName": "AppName or path" }
          ],
          "requiredAppsCount": "6"
        }
      ]
    },
    "windowsPolicy": {
      "prohibitedApps": [
        { "AppName": "AppName or path" }
      ],
      "requiredAppsCategories": [
        {
          "apps": [
            { "AppName": "AppName or path" }
          ],
          "requiredAppsCount": "4"
        }
      ]
    }
  },
  "systemPolicy": {
    "ApprovedVersionforWindows10": "null",
    "ApprovedVersionforWindowsNon-10.": "19041.450",
    "NudgedVersionforWindows10": "null",
    "NudgedVersionforWindowsnon-10.": "19041.449",
    "ApprovedVersionforMAC": "15.6.1",
    "NudgedVersionforMAC": "",
    "ScreenIdleWindows": 3600,
    "ScreenLockWindows": 1,
    "ScreenLockMac": 900,
    "ScreenIdleMac": 1800,
    "RemoteLoginWindowsNudge": "NUDGE",
    "RemoteLoginMacNudge": "Fail",
    "ScanPage": "Yes",
    "Firewall": "PASS",
    "DiskEncryption": "Pass",
    "WifiNetworks": "Fail",
    "AutomaticUpdates": "Fail",
    "ScanIntervalHours": 24,
    "IsShowPIIScan": "No",
    "AdminEmail": "admin@example.com",
    "NW-WPA": "Fail",
    "NW-WPA-2": "Fail",
    "NW-WPA-3": "Fail",
    "NetworkIDPolicy": "PASS",
    "NetworkIDIPs": "1.1.1.1,8.8.8.8",
    "WinDefenderAV": "",
    "ActiveWifiNetwork": "FAIL",
    "KnownWifiNetworks": "FAIL"
  }
}
```

### systemPolicy Field Reference

| Field | Type | Valid Values | Notes |
|---|---|---|---|
| `Firewall` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `DiskEncryption` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `AutomaticUpdates` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `RemoteLoginWindowsNudge` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `RemoteLoginMacNudge` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `WifiNetworks` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `NW-WPA` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `NW-WPA-2` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `NW-WPA-3` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `ActiveWifiNetwork` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `KnownWifiNetworks` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `NetworkIDPolicy` | string | PASS/FAIL/NUDGE | Case-insensitive |
| `NetworkIDIPs` | string | Comma-separated IPs | e.g. "1.1.1.1,8.8.8.8" |
| `WinDefenderAV` | string | PASS/FAIL/NUDGE or empty | Empty = treat as PASS |
| `ScreenIdleMac` | integer | ≥ 1 (seconds) | Invalid = N/A = PASS |
| `ScreenLockMac` | integer | ≥ 0 (seconds, 0 = Immediately) | Invalid = N/A = PASS |
| `ScreenIdleWindows` | integer | ≥ 1 (seconds) | Invalid = N/A = PASS |
| `ScreenLockWindows` | integer | 0 or 1 | Invalid = N/A = PASS |
| `ApprovedVersionforMAC` | string | version string | TBD — see scan-logic.md |
| `NudgedVersionforMAC` | string | version string | TBD — see scan-logic.md |
| `ApprovedVersionforWindows10` | string | version string | TBD — see scan-logic.md |
| `ApprovedVersionforWindowsNon-10.` | string | version string | TBD — see scan-logic.md |
| `NudgedVersionforWindows10` | string | version string | TBD — see scan-logic.md |
| `NudgedVersionforWindowsnon-10.` | string | version string | TBD — see scan-logic.md |
| `ScanIntervalHours` | integer | ≥ 1 | Default 24 if not set |
| `ScanPage` | string | Yes/No | Whether to show scan UI |
| `IsShowPIIScan` | string | Yes/No | Not implemented in v1 |
| `AdminEmail` | string | email | Admin contact |

## Result Submission

**Request:** TBD (endpoint, method, auth headers, payload structure)

## Notes
- All PASS/FAIL/NUDGE policy values are case-insensitive
- `AppPolicy` may be `"No matching policy found"` (string) when no app policy is defined for the org — treat as no app policy
- `ScanIntervalHours` is driven by policy, not local config. Default: 24 hours
