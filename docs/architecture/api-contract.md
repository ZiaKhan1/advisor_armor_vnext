---
status: active
audience: both
created: 2026-04-05
---

# API Contract

## Policy Fetch

**Method:** POST
**Content-Type:** multipart/form-data
**Endpoint:** `config.apiBaseUrl` + policy path (configured in `src/config.ts`)
**Auth:** None defined in v1 — to be confirmed

### Request Body (FormData)

| Field | Value | Notes |
|---|---|---|
| `type` | `"POLICY"` | Hardcoded constant |
| `email` | user's email | From `storage/user.json` |
| `advisorArmorVersion` | app version | From `package.json` |

### Response

- **Success:** JSON object with `AppPolicy` and `systemPolicy` (see structure below)
- **API-level error:** `{ "status": "error", ... }` — throw and surface to user
- **HTTP error:** non-2xx status — throw with status code and message

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

**Method:** POST
**Content-Type:** application/json
**Endpoint:** `config.apiBaseUrl` + submission path (configured in `src/config.ts`)
**Auth:** None defined in v1 — to be confirmed

### Payload Structure

```json
{
  "SystemPolicyResult": {
    "Email": "user@example.com",
    "version": "1.0.0",
    "appletVersion": "1.0.0",
    "deviceName": "MacBook Pro",
    "osVersion": "15.1.0",
    "hardwareModel": "MacBookPro18,1",
    "hardwareSerialNo": "ABC123",
    "hardwareUUID": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "manufacturer": "Apple",
    "osPlatform": "darwin",
    "scanOverallResult": "PASS",
    "osVersionResult": "PASS",
    "firewallResult": "PASS",
    "diskEncryptionResult": "FAIL",
    "winDefenderAVResult": "PASS",
    "screenLockResult": "PASS",
    "screenIdleResult": "NUDGE",
    "automaticUpdatesResult": "PASS",
    "remoteLoginResult": "PASS",
    "openWifiConnectionsResult": "PASS",
    "activeWifiNetworkResult": "PASS",
    "knownWifiNetworksResult": "FAIL",
    "applicationsResult": "PASS",
    "wifiWPA": "PASS",
    "wifiWPA2": "PASS",
    "wifiWPA3": "PASS",
    "wifiID": "NA",
    "wifiIFace": "en0",
    "wifiModel": "NA",
    "wifiSSID": "MyNetwork",
    "wifiBSSID": "aa:bb:cc:dd:ee:ff",
    "wifiChannel": 6,
    "wifiFrequency": 2437,
    "wifiType": "NA",
    "wifiSecurity": "WPA2",
    "wifiSignalLevel": -55,
    "wifiTxRate": 144,
    "networkIdResult": "PASS",
    "networkIDIPs": "1.1.1.1,8.8.8.8",
    "networkIDIPInUse": "1.1.1.1"
  },
  "AppPolicyResult": {
    "appsScanResult": "FAIL",
    "installedProhibitedApps": ["AppName"],
    "missingRequiredAppsCategories": ["CategoryName"]
  }
}
```

### SystemPolicyResult Field Reference

| Field | Source | Notes |
|---|---|---|
| `Email` | `user.json` | User's registered email |
| `version` | `package.json` | App version — sent twice (see `appletVersion`) |
| `appletVersion` | `package.json` | Same as `version` — legacy duplication, may be removed |
| `deviceName` | device scan | Device hostname |
| `osVersion` | device scan | OS version string |
| `hardwareModel` | device scan | e.g. MacBookPro18,1 |
| `hardwareSerialNo` | device scan | Hardware serial number |
| `hardwareUUID` | device scan | Unique device identifier |
| `manufacturer` | device scan | Platform name e.g. Apple |
| `osPlatform` | device scan | e.g. darwin, win32 |
| `scanOverallResult` | scan result | Overall PASS/FAIL/NUDGE |
| `osVersionResult` | scan result | PASS/FAIL/NUDGE |
| `firewallResult` | scan result | PASS/FAIL/NUDGE |
| `diskEncryptionResult` | scan result | PASS/FAIL/NUDGE |
| `winDefenderAVResult` | scan result | PASS/FAIL/NUDGE |
| `screenLockResult` | scan result | PASS/FAIL/NUDGE |
| `screenIdleResult` | scan result | PASS/FAIL/NUDGE |
| `automaticUpdatesResult` | scan result | PASS/FAIL/NUDGE |
| `remoteLoginResult` | scan result | PASS/FAIL/NUDGE |
| `openWifiConnectionsResult` | hardcoded | Always `"PASS"` — backward compat, to be removed |
| `activeWifiNetworkResult` | scan result | PASS/FAIL/NUDGE |
| `knownWifiNetworksResult` | scan result | PASS/FAIL/NUDGE |
| `applicationsResult` | scan result | PASS/FAIL/NUDGE |
| `wifiWPA/WPA2/WPA3` | device scan | Result for active WiFi connection only (first connection) |
| `wifiID/IFace/Model/SSID/BSSID/...` | device scan | Active WiFi connection details — `"NA"` if not available |
| `networkIdResult` | scan result | PASS/FAIL/NUDGE |
| `networkIDIPs` | policy | Comma-separated allowed IPs from policy |
| `networkIDIPInUse` | scan result | The actual public IP detected during scan |

### AppPolicyResult Field Reference

| Field | Source | Notes |
|---|---|---|
| `appsScanResult` | scan result | Overall app policy result — PASS/FAIL/NUDGE |
| `installedProhibitedApps` | scan result | Array of prohibited app names found on device |
| `missingRequiredAppsCategories` | scan result | Array of required app category names not satisfied |

### Default Values

- Result fields (`getDefaultResult`): if the scan element was not run or not applicable, value defaults to `"PASS"`
- Non-result fields (`getDefaultValue`): if value is unavailable, defaults to `"NA"`

## Notes
- All PASS/FAIL/NUDGE policy values are case-insensitive
- `AppPolicy` may be `"No matching policy found"` (string) when no app policy is defined for the org — treat as no app policy
- `ScanIntervalHours` is driven by policy, not local config. Default: 24 hours
