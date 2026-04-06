---
status: active
audience: both
created: 2026-04-05
---

# Scan Elements & Logic

## General Rules
- All policy PASS/FAIL/NUDGE string values are **case-insensitive**
- If device setting is OK → always **PASS** regardless of policy value
- If device setting is NOT OK:
  - Policy = FAIL → **FAIL** (red ✗)
  - Policy = NUDGE → **WARNING** (yellow ⚠)
  - Policy = PASS → **PASS** (green ✓)
- Exception: screen and threshold-based checks have their own logic (see below)

---

## Scan Elements

### 1. Firewall
- **Policy field:** `Firewall`
- **Check:** Is firewall enabled on device?
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Platforms:** Mac, Windows

### 2. Disk Encryption
- **Policy field:** `DiskEncryption`
- **Check:** Is FileVault (Mac) / BitLocker (Windows) enabled?
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Platforms:** Mac, Windows

### 3. Automatic Updates
- **Policy field:** `AutomaticUpdates`
- **Check:** Are automatic OS updates enabled?
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Platforms:** Mac, Windows

### 4. Remote Login
- **Policy field:** `RemoteLoginMacNudge` (Mac), `RemoteLoginWindowsNudge` (Windows)
- **Check:** Is remote login / SSH enabled? TBD — exact check to be defined at implementation
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Platforms:** Mac, Windows

### 5. Windows Defender AV
- **Policy field:** `WinDefenderAV`
- **Check:** Is Windows Defender AV active?
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Special case:** Empty policy value → treat as PASS (policy not enforced)
- **Platforms:** Windows only

### 6. OS Version
- **Policy fields:** `ApprovedVersionforMAC`, `NudgedVersionforMAC`, `ApprovedVersionforWindows10`, `NudgedVersionforWindows10`, `ApprovedVersionforWindowsNon-10.`, `NudgedVersionforWindowsnon-10.`
- **Check:** Is device OS version at or above the approved/nudged threshold?
- **Logic:**
  - Device version ≥ Approved version → **PASS**
  - Device version ≥ Nudged version but < Approved version → **NUDGE**
  - Device version < Nudged version → **FAIL**
- **Version comparison:** Policy version strings are prefixed with `>=` before comparison (e.g. `"15.1"` → `">=15.1"`). Policy values are always treated as strings even if backend stores them as numbers.
- **Windows 10 vs Non-10 detection:** Determined by the first segment of the OS version string. If the first segment is more than 2 digits (e.g. `19041`), it is a Non-10 build; otherwise it is Windows 10.
- **Platforms:** Mac, Windows

### 7. Screen Idle — Mac
- **Policy field:** `ScreenIdleMac`
- **Valid policy values:** Integer ≥ 1 (seconds). Invalid = N/A = PASS
- **Device setting:** Never, or a duration in seconds
- **Logic:**
  - Invalid policy → **PASS** (N/A)
  - Device = Never → **FAIL**
  - Device value > policy value → **FAIL**
  - Device value ≤ policy value → **PASS**
- **Result:** PASS/FAIL only (no NUDGE)
- **Platforms:** Mac only

### 8. Screen Lock — Mac
- **Policy field:** `ScreenLockMac`
- **Device setting:** Require Password After Screen Saver — possible values: Immediately, 5 seconds, 1 minute, … , 8 hours, Never
- **Valid policy values:** Integer ≥ 0 (seconds). 0 = Immediately. Invalid = N/A = PASS
- **Logic:**
  - Invalid policy → **PASS** (N/A, shown in UI as N/A)
  - Policy = 0 (Immediately):
    - Device = Immediately → **PASS**
    - Device = anything else (including Never) → **FAIL**
  - Policy ≥ 1:
    - Device = Never → **FAIL**
    - Device = Immediately → **PASS**
    - Device value > policy value → **FAIL**
    - Device value ≤ policy value → **PASS**
- **Result:** PASS/FAIL only (no NUDGE)
- **Platforms:** Mac only

### 9. Screen Idle — Windows
- **Policy field:** `ScreenIdleWindows`
- **Device setting:** Screen Saver wait time in minutes (always a numeric value, no "Never" option)
- **Valid policy values:** Integer ≥ 1 (seconds). Invalid (0, negative, text, empty) = N/A = PASS
- **Logic:**
  - Invalid policy → **PASS** (N/A)
  - Device wait time > policy value → **FAIL**
  - Device wait time ≤ policy value → **PASS**
- **Result:** PASS/FAIL only (no NUDGE)
- **Platforms:** Windows only

### 10. Screen Lock — Windows
- **Policy field:** `ScreenLockWindows`
- **Device setting:** "On resume, display logon screen" checkbox in Screen Saver Settings (on/off)
- **Valid policy values:** 0 or 1 only. Anything else = N/A = PASS
- **Logic:**
  - Invalid policy → **PASS** (N/A)
  - Policy = 1 (logon required):
    - Option selected on device → **PASS**
    - Option not selected → **FAIL**
  - Policy = 0 (logon not required):
    - Always **PASS** regardless of device setting
- **Result:** PASS/FAIL only (no NUDGE)
- **Platforms:** Windows only

### 11. Active WiFi Network
- **Policy field:** `ActiveWifiNetwork`
- **Valid policy values:** PASS/FAIL/NUDGE (case-insensitive). Anything else → treat as PASS
- **Check:** Is the currently connected WiFi network using a secure protocol (WPA2/WPA3)? Open/WEP/WPA = not secure.
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Implementation detail:** TBD
- **Platforms:** Mac, Windows

### 12. Known WiFi Networks
- **Policy field:** `KnownWifiNetworks`
- **Valid policy values:** PASS/FAIL/NUDGE (case-insensitive). Anything else → treat as PASS
- **Check:** Are any saved/known WiFi networks on the device using an insecure protocol?
- **Result:** Standard PASS/FAIL/NUDGE logic
- **Implementation detail:** TBD
- **Platforms:** Mac, Windows

### Not implemented (fields present in API response but ignored)
- `WifiNetworks` — not used
- `NW-WPA` — not used
- `NW-WPA-2` — not used
- `NW-WPA-3` — not used
- `IsShowPIIScan` — not used in v1

### 13. Network ID
- **Policy fields:** `NetworkIDPolicy`, `NetworkIDIPs`
- **Check:** Fetch device public IP from `https://whatismyip.akamai.com` or `https://ifconfig.co/ip`. Check if it is in the comma-separated list in `NetworkIDIPs`.
- **Logic:**
  - Device IP in list → **PASS**
  - Device IP not in list → result per `NetworkIDPolicy` (PASS/FAIL/NUDGE)
- **Platforms:** Mac, Windows

### 14. App Policy — Prohibited Apps
- **Source:** `AppPolicy.macPolicy.prohibitedApps` / `AppPolicy.windowsPolicy.prohibitedApps`
- **Check:** Is any prohibited app installed on the device?
- **Logic:**
  - Any prohibited app found → always **FAIL** (no configurable policy action)
  - No prohibited apps found → **PASS**
- **App detection:** TBD at implementation (path-based for Mac, TBD for Windows)
- **Platforms:** Mac, Windows (separate lists)
- **Special case:** If `AppPolicy` is `"No matching policy found"` (string) → skip this check

### 15. App Policy — Required Apps
- **Source:** `AppPolicy.macPolicy.requiredAppsCategories` / `AppPolicy.windowsPolicy.requiredAppsCategories`
- **Check:** Is the minimum number of required apps installed?
- **Logic:**
  - Number of installed apps from list ≥ `requiredAppsCount` → **PASS**
  - Number of installed apps from list < `requiredAppsCount` → **FAIL**
- **App detection:** TBD at implementation
- **Platforms:** Mac, Windows (separate lists)
- **Special case:** If `AppPolicy` is `"No matching policy found"` (string) → skip this check
