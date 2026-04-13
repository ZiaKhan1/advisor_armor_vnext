---
status: active
audience: both
created: 2026-04-05
---

# API Contract

## Onboarding Flow

The onboarding sequence involves three sequential API calls:

1. User enters email → client-side format validation (regex)
2. **Validate Email** → if `status: true`, proceed; else show error
3. **Check Access** → retrieve `admin` flag and `companyName`; show code input
4. User enters 4-digit verification code → **Validate Code** → if `valid: true`, proceed
5. Write `{ email, isAdmin, companyName }` to `storage/user.json`

> **Note:** `waitForInternet()` is called before Validate Email to handle auto-launch on startup where the network may not be immediately available. The initial implementation preserves the current behaviour: probe `https://www.google.com` every 2 seconds for up to 60 attempts (about 120 seconds) before failing.

> **Naming note:** `advisorArmorVersion` is the current backend contract field name. Inside the app, prefer generic names such as `appVersion`, and map them to `advisorArmorVersion` at the API boundary.

> **Configuration note:** All five backend endpoints are configured as fully independent URLs in `src/config.ts`. They are not derived from a shared `apiBaseUrl`.

> **Error handling note:** The backend service layer should normalise failures into a small internal error model with categories such as `http`, `timeout`, `network`, `application`, and `unknown`. UI copy stays generic; logs should preserve the specific error category and details.

---

## Validate Email

**Method:** POST
**Content-Type:** multipart/form-data
**Endpoint:** `config.validateEmailUrl`
**Auth:** None. Endpoints are accessible in v1.

### Request Body (FormData)

| Field                 | Value        | Notes                                                                                                                               |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `email`               | user's email | As entered by user                                                                                                                  |
| `advisorArmorVersion` | app version  | Current backend contract field name. Internal code may refer to this value as `appVersion` before mapping it into the request body. |

### Response

```json
{ "status": true }
```

| Field    | Type    | Notes                                                                  |
| -------- | ------- | ---------------------------------------------------------------------- |
| `status` | boolean | `true` = email recognised; `false` = email not found or not authorised |

### Mock Behaviour

Return `{ "status": true }` for any email.

### Client Behaviour

- Call `waitForInternet()` before sending the request
- Apply an explicit client-side timeout of 20 seconds
- Keep the existing success rule: only `response.status === true` is treated as success
- Use generic user-facing error messages
- Log response details only on error

---

## Validate Code

**Method:** POST
**Content-Type:** multipart/form-data
**Endpoint:** `config.validateCodeUrl`
**Auth:** None. Endpoints are accessible in v1.

### Request Body (FormData)

| Field                 | Value          | Notes                                                                                                                               |
| --------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | `"CHECK_CODE"` | Hardcoded constant                                                                                                                  |
| `email`               | user's email   |                                                                                                                                     |
| `code`                | 4-digit code   | As entered by user                                                                                                                  |
| `advisorArmorVersion` | app version    | Current backend contract field name. Internal code may refer to this value as `appVersion` before mapping it into the request body. |

### Response

```json
{ "valid": true }
```

| Field   | Type    | Notes                                                        |
| ------- | ------- | ------------------------------------------------------------ |
| `valid` | boolean | `true` = code is correct; `false` = code is wrong or expired |

### Mock Behaviour

Return `{ "valid": true }` if submitted code matches `config.mockOtpCode` (default: `"1234"`); otherwise `{ "valid": false }`.

### Client Behaviour

- Apply an explicit client-side timeout of 20 seconds
- Keep the existing success rule: use only the boolean `valid` field
- Use generic user-facing error messages
- Do not log successful responses
- Log only on error; in error cases, include the submitted verification code for diagnostics

---

## Check Access

**Method:** POST
**Content-Type:** multipart/form-data
**Endpoint:** `config.checkAccessUrl`
**Auth:** None. Endpoints are accessible in v1.

### Request Body (FormData)

| Field                 | Value            | Notes                                                                                                                               |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | `"CHECK_ACCESS"` | Hardcoded constant                                                                                                                  |
| `email`               | user's email     |                                                                                                                                     |
| `advisorArmorVersion` | app version      | Current backend contract field name. Internal code may refer to this value as `appVersion` before mapping it into the request body. |

### Response

```json
{ "admin": false, "companyName": "Acme Corp" }
```

| Field         | Type    | Notes                                             |
| ------------- | ------- | ------------------------------------------------- |
| `admin`       | boolean | Whether user has admin privileges                 |
| `companyName` | string  | Organisation name — stored in `storage/user.json` |

### Mock Behaviour

Return `{ "admin": false, "companyName": "Demo Company" }`.

### Client Behaviour

- Apply an explicit client-side timeout of 20 seconds
- Keep response handling loose and trust the returned JSON shape
- Store both `admin` and `companyName` in `storage/user.json`
- Use generic user-facing error messages
- Log response details only on error

---

## Policy Fetch

**Method:** POST
**Content-Type:** multipart/form-data
**Endpoint:** `config.policyUrl`
**Auth:** None. Endpoints are accessible in v1.

### Request Body (FormData)

| Field                 | Value        | Notes                                                                                                                               |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | `"POLICY"`   | Hardcoded constant                                                                                                                  |
| `email`               | user's email | From `storage/user.json`                                                                                                            |
| `advisorArmorVersion` | app version  | Current backend contract field name. Internal code may refer to this value as `appVersion` before mapping it into the request body. |

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
      "prohibitedApps": [{ "AppName": "AppName or path" }],
      "requiredAppsCategories": [
        {
          "apps": [{ "AppName": "AppName or path" }],
          "requiredAppsCount": "6"
        }
      ]
    },
    "windowsPolicy": {
      "prohibitedApps": [{ "AppName": "AppName or path" }],
      "requiredAppsCategories": [
        {
          "apps": [{ "AppName": "AppName or path" }],
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

| Field                              | Type    | Valid Values                   | Notes                                                  |
| ---------------------------------- | ------- | ------------------------------ | ------------------------------------------------------ |
| `Firewall`                         | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `DiskEncryption`                   | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `AutomaticUpdates`                 | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `RemoteLoginWindowsNudge`          | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `RemoteLoginMacNudge`              | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `WifiNetworks`                     | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `NW-WPA`                           | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `NW-WPA-2`                         | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `NW-WPA-3`                         | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `ActiveWifiNetwork`                | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `KnownWifiNetworks`                | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `NetworkIDPolicy`                  | string  | PASS/FAIL/NUDGE                | Case-insensitive                                       |
| `NetworkIDIPs`                     | string  | Comma-separated IPs            | e.g. "1.1.1.1,8.8.8.8"                                 |
| `WinDefenderAV`                    | string  | PASS/FAIL/NUDGE or empty       | Empty = treat as PASS                                  |
| `ScreenIdleMac`                    | integer | ≥ 1 (seconds)                  | Invalid = N/A = PASS                                   |
| `ScreenLockMac`                    | integer | ≥ 0 (seconds, 0 = Immediately) | Invalid = N/A = PASS                                   |
| `ScreenIdleWindows`                | integer | ≥ 1 (seconds)                  | Invalid = N/A = PASS                                   |
| `ScreenLockWindows`                | integer | 0 or 1                         | Invalid = N/A = PASS                                   |
| `ApprovedVersionforMAC`            | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `NudgedVersionforMAC`              | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `ApprovedVersionforWindows10`      | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `ApprovedVersionforWindowsNon-10.` | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `NudgedVersionforWindows10`        | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `NudgedVersionforWindowsnon-10.`   | string  | version string                 | Compared using the OS version logic in `scan-logic.md` |
| `ScanIntervalHours`                | integer | ≥ 1                            | Default 24 if not set                                  |
| `ScanPage`                         | string  | Yes/No                         | Whether to show scan UI                                |
| `IsShowPIIScan`                    | string  | Yes/No                         | Not implemented in v1                                  |
| `AdminEmail`                       | string  | email                          | Admin contact                                          |

### Mock Behaviour

- Return one fixed backend-shaped policy object for all users
- Use the real parser and normalisation flow against that mock response

### Client Behaviour

- Apply an explicit client-side timeout of 30 seconds
- Each scan fetches the latest policy before device evaluation starts
- If offline or policy fetch fails, block the scan and show a generic full-window error with a `Try again` action
- `Try again` restarts the full scan flow from the beginning, including a fresh policy fetch
- On success, log the full raw policy response only
- On error, log the full failure context including endpoint, email, and classified error type

## Result Submission

**Method:** POST
**Content-Type:** application/json
**Endpoint:** `config.sendScanResultUrl`
**Auth:** None. Endpoints are accessible in v1.

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

### Response Handling

- Treat the response as plain text
- Do not depend on a typed JSON success payload
- Preserve backend payload compatibility exactly

### Mock Behaviour

- Always succeed
- Return plain text, mirroring the real contract shape

### Client Behaviour

- Apply an explicit client-side timeout of 20 seconds
- Submit results only at the end of a scan
- Retry failed submissions in the background
- Default retry settings: 3 total attempts, fixed 5 second delay between attempts
- Retry settings are configurable in `src/config.ts`
- If all submission attempts fail, show a generic inline error in the main window
- The app does not offer a standalone resend action; users can re-run the scan to trigger another submission attempt
- Do not log successful response text
- Log full response text and failure details on error only

### SystemPolicyResult Field Reference

| Field                               | Source         | Notes                                                     |
| ----------------------------------- | -------------- | --------------------------------------------------------- |
| `Email`                             | `user.json`    | User's registered email                                   |
| `version`                           | `package.json` | App version — sent twice (see `appletVersion`)            |
| `appletVersion`                     | `package.json` | Same as `version` — legacy duplication, may be removed    |
| `deviceName`                        | device scan    | Device hostname                                           |
| `osVersion`                         | device scan    | OS version string                                         |
| `hardwareModel`                     | device scan    | e.g. MacBookPro18,1                                       |
| `hardwareSerialNo`                  | device scan    | Hardware serial number                                    |
| `hardwareUUID`                      | device scan    | Unique device identifier                                  |
| `manufacturer`                      | device scan    | Platform name e.g. Apple                                  |
| `osPlatform`                        | device scan    | e.g. darwin, win32                                        |
| `scanOverallResult`                 | scan result    | Overall PASS/FAIL/NUDGE                                   |
| `osVersionResult`                   | scan result    | PASS/FAIL/NUDGE                                           |
| `firewallResult`                    | scan result    | PASS/FAIL/NUDGE                                           |
| `diskEncryptionResult`              | scan result    | PASS/FAIL/NUDGE                                           |
| `winDefenderAVResult`               | scan result    | PASS/FAIL/NUDGE                                           |
| `screenLockResult`                  | scan result    | PASS/FAIL/NUDGE                                           |
| `screenIdleResult`                  | scan result    | PASS/FAIL/NUDGE                                           |
| `automaticUpdatesResult`            | scan result    | PASS/FAIL/NUDGE                                           |
| `remoteLoginResult`                 | scan result    | PASS/FAIL/NUDGE                                           |
| `openWifiConnectionsResult`         | hardcoded      | Always `"PASS"` — backward compat, to be removed          |
| `activeWifiNetworkResult`           | scan result    | PASS/FAIL/NUDGE                                           |
| `knownWifiNetworksResult`           | scan result    | PASS/FAIL/NUDGE                                           |
| `applicationsResult`                | scan result    | PASS/FAIL/NUDGE                                           |
| `wifiWPA/WPA2/WPA3`                 | device scan    | Result for active WiFi connection only (first connection) |
| `wifiID/IFace/Model/SSID/BSSID/...` | device scan    | Active WiFi connection details — `"NA"` if not available  |
| `networkIdResult`                   | scan result    | PASS/FAIL/NUDGE                                           |
| `networkIDIPs`                      | policy         | Comma-separated allowed IPs from policy                   |
| `networkIDIPInUse`                  | scan result    | The actual public IP detected during scan                 |

### AppPolicyResult Field Reference

| Field                           | Source      | Notes                                              |
| ------------------------------- | ----------- | -------------------------------------------------- |
| `appsScanResult`                | scan result | Overall app policy result — PASS/FAIL/NUDGE        |
| `installedProhibitedApps`       | scan result | Array of prohibited app names found on device      |
| `missingRequiredAppsCategories` | scan result | Array of required app category names not satisfied |

### Default Values

- Result fields (`getDefaultResult`): if the scan element was not run or not applicable, value defaults to `"PASS"`
- Non-result fields (`getDefaultValue`): if value is unavailable, defaults to `"NA"`

## Parsed Policy (Internal Structure)

After fetching, the raw policy response is passed through `parseUserPolicy()` which produces the internal `parsedUserPolicy` object used throughout the scan logic:

```ts
{
  osVersions: {
    win:    { ok: ">=19041.450", nudge: ">=19041.449" },
    winNon10: { ok: ">=19041.450", nudge: ">=19041.449" },
    mac:    { ok: ">=15.1.0", nudge: ">=14.0.0" }
  },
  screenIdle: {
    win: 3600,   // null if invalid or below minimum (1)
    mac: 1800
  },
  screenLock: {
    win: 1,      // null if invalid or below minimum (0)
    mac: 900
  },
  remoteLogin: {
    win: "FAIL",
    mac: "FAIL"
  },
  firewall: "PASS",
  diskEncryption: "PASS",
  winDefenderAV: "PASS",
  activeWifiNetwork: "FAIL",
  knownWifiNetworks: "FAIL",
  automaticUpdates: "FAIL",
  scan: true,
  IsShowPIIScan: false,
  scanIntervalHours: 24,
  netWorkSecurity: {
    NWWPA: "PASS",
    NWWPA2: "PASS",
    NWWPA3: "PASS"
  },
  networkID: "PASS",
  networkIDIPs: "1.1.1.1,8.8.8.8",
  appsPolicy: {
    prohibitedApps: ["AppName"],
    requiredAppsCategories: [
      { apps: ["App1", "App2"], requiredAppsCount: "3" }
    ]
  }
}
```

### Parsing Notes

- **`GetValidRequiredStatus`:** All PASS/FAIL/NUDGE policy values are normalised — null, empty, or unrecognised values default to `"PASS"`. Comparison is case-insensitive.
- **OS version strings:** Always converted to strings via `String()` even if backend returns them as numbers. Prefixed with `>=` when used for comparison.
- **Screen idle/lock:** Parsed via `convertToIntOrNull`. Values below the minimum (idle min=1, lock min=0) or non-numeric values → `null` → treated as PASS (N/A) in scan logic.
- **`scanIntervalHours`:** Parsed as `parseFloat`. Falls back to the config default (24) if not present in policy.
- **AppPolicy platform selection:** `macPolicy` selected on Mac, `windowsPolicy` on Windows. If `AppPolicy` is the string `"No matching policy found"`, both prohibited and required app checks are skipped.
- **`prohibitedApps`:** Mapped to a flat array of trimmed app name strings. Entries with null `AppName` are filtered out.
- **`requiredAppsCategories`:** Categories with empty app lists or missing `requiredAppsCount` are filtered out.

## Notes

- All PASS/FAIL/NUDGE policy values are case-insensitive
- `AppPolicy` may be `"No matching policy found"` (string) when no app policy is defined for the org — treat as no app policy
- `ScanIntervalHours` is driven by policy, not local config. Default: 24 hours
