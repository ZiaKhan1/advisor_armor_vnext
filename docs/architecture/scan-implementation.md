---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# Scan Implementation

## Overview

All scan checks run in the **main process**. Each check is a TypeScript function that queries the OS and returns a simple value (boolean, string, or number). The scan engine calls these functions, evaluates results against policy, and produces a PASS/FAIL/NUDGE result per element.

## OS Command Execution

Use a small typed command runner in the main process. Prefer `execFile` as the default. Fall back to `spawn` only when a check truly needs streamed or stdin-driven execution.

### `execFile` — default path

From Node.js `child_process`. Best for short commands with explicit executable + argument lists, timeouts, and predictable output.

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const { stdout } = await execFileAsync('bash', ['-lc', 'fdesetup status'], {
  timeout: 10_000
})
```

### `spawn` — exception path

Use only when a check genuinely needs streamed output or stdin-driven scripting.

```ts
import { spawn } from 'child_process'

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '-'
    ])
    let output = ''
    ps.stdout.on('data', (data) => (output += data))
    ps.stderr.on('data', (data) => reject(data.toString()))
    ps.on('close', () => resolve(output))
    ps.stdin.write(script)
    ps.stdin.end()
  })
}

function runShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sh = spawn('bash', ['-s'])
    let output = ''
    sh.stdout.on('data', (data) => (output += data))
    sh.stderr.on('data', (data) => reject(data.toString()))
    sh.on('close', () => resolve(output))
    sh.stdin.write(script)
    sh.stdin.end()
  })
}
```

### Which to use

Default to `execFile`:

| Scenario                                                        | Tool                             |
| --------------------------------------------------------------- | -------------------------------- |
| Simple Mac shell command                                        | `execFile('bash', ['-lc', ...])` |
| Simple Windows command (`powershell.exe`, `netsh`, `reg query`) | `execFile(...)`                  |
| Complex multi-line PowerShell                                   | `spawn` → `runPowerShell`        |
| Complex multi-line bash                                         | `spawn` → `runShell`             |

### PowerShell Invocation

When a Windows scan check needs PowerShell, invoke it as a short-lived,
non-interactive child process:

```ts
execFile(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script
  ],
  { timeout: 10_000, windowsHide: true }
)
```

Use `-NoProfile` so user profile scripts cannot slow down the scan, emit
unexpected output, redefine commands, or fail before the scan command runs.
Use `-NonInteractive` so the child process cannot block waiting for user input.
Use `-ExecutionPolicy Bypass` only for the child process so normal local
execution-policy restrictions do not interfere with inline scan commands. This
does not permanently modify the user's machine.

`-ExecutionPolicy Bypass` is not a full enterprise-policy bypass. It will not
override Group Policy, AppLocker, Windows Defender Application Control,
Constrained Language Mode, disabled PowerShell, endpoint security controls, or
COM restrictions. If PowerShell cannot run or cannot access the required setting,
the scan check should log the error and return `null` / `unknown`.

## Platform Differences

Each scan element has a Mac and Windows implementation. Platform is detected via `os.platform()`:

```ts
import { platform } from 'os'

const isMac = platform() === 'darwin'
const isWindows = platform() === 'win32'
```

Mac checks use shell commands (`defaults read`, `fdesetup`, `socketfilterfw`, `netstat`, `system_profiler`, etc.).
Windows checks use PowerShell (`Get-NetFirewallProfile`, `Get-MpPreference`, Shell COM properties, etc.), registry queries, or `netsh` for WiFi.

## Windows Defender AV

Windows reads Microsoft Defender Antivirus status with:

```powershell
(Get-MpPreference).DisableRealtimeMonitoring
```

The check preserves old application behavior:

- `False` → Defender real-time monitoring is enabled → PASS
- `True` → Defender real-time monitoring is disabled → device is not OK and the configured `WinDefenderAV` policy controls whether the user sees FAIL, NUDGE, or PASS
- command failure, null, or unexpected output → UNKNOWN internally and PASS for result reporting

The unknown case intentionally shows third-party antivirus guidance and does not penalize the user. This matches the old application behavior for machines where another antivirus product or system policy prevents Defender real-time monitoring from being read.

## Disk Encryption / BitLocker

### macOS

Read FileVault status with:

```sh
fdesetup status
```

Expected mapping:

- `FileVault is On.` → `enabled`
- `FileVault is Off.` → `disabled`
- output containing `Encryption in progress` → `encrypting`
- output containing `Decryption in progress` → `decrypting`
- command error, timeout, or unexpected output → `unknown`

`enabled` and `encrypting` are considered OK. `disabled` and `decrypting` are
not OK and should be evaluated against policy. `unknown` should pass the scan
but recommend that the user verify FileVault is enabled.

### Windows

Avoid PowerShell commands that require elevation for the normal background scan,
such as `Get-BitLockerVolume` or `manage-bde`, unless later testing proves they
are reliable in the target environment.

The previous App version (3.xx) shipped a .NET helper executable that read the
Windows Shell property `System.Volume.BitLockerProtection` for `C:`:

```csharp
using Microsoft.WindowsAPICodePack.Shell;
using Microsoft.WindowsAPICodePack.Shell.PropertySystem;

IShellProperty prop = ShellObject
    .FromParsingName("C:")
    .Properties
    .GetProperty("System.Volume.BitLockerProtection");

int? bitLockerProtectionStatus = (prop as ShellProperty<int?>).Value;

if (
    bitLockerProtectionStatus.HasValue &&
    (
        bitLockerProtectionStatus == 1 ||
        bitLockerProtectionStatus == 3 ||
        bitLockerProtectionStatus == 5
    )
)
    Console.WriteLine("ON");
else
    Console.WriteLine("OFF");
```

For the TypeScript implementation, first try reading the same Shell property via
PowerShell COM:

```powershell
$shell = New-Object -ComObject Shell.Application
$systemDrive = $env:SystemDrive
$drive = $shell.Namespace(17).ParseName($systemDrive)
if ($null -eq $drive) {
  Write-Output "UNKNOWN"
  exit 0
}
$value = $drive.ExtendedProperty("System.Volume.BitLockerProtection")
Write-Output $value
```

Expected mapping for Windows v1:

- `1` or `3` → `enabled`
- `5` → `suspended`
- any other numeric value → `disabled`
- command failure, blank output, `UNKNOWN`, or parse failure → `unknown`

If PowerShell COM proves unreliable in customer environments, add a signed native
helper based on the previous .NET implementation and package it with the
Electron app.

## Error Handling

- Each check is wrapped in a try/catch
- If a check throws or times out → log the error, return `null`
- `null` result → treated as PASS in scan logic (cannot determine = do not penalise user)
- All errors logged to file regardless of whether they are shown to the user

## Provisional Bottom-Layer Reads

- During early implementation, the bottom-most OS read for a specific check may return a provisional hardcoded value if the real device-setting lookup is still under investigation
- This applies only to the device-setting read layer, not to policy parsing, evaluation, onboarding, submission, or persistence
- Provisional implementations should be explicitly marked in code and can exist in both mock and real backend modes
- UI should behave normally; provisional checks are not surfaced to the user as a special state

## Screen Idle and Screen Lock

Policy parsing normalizes screen thresholds before evaluation:

- `ScreenIdleMac` / `ScreenIdleWindows`: valid values are integers >= 1,
  expressed in seconds. Invalid, empty, zero, or negative values become `null`
  and are shown as N/A.
- `ScreenLockMac`: valid values are integers >= 0, expressed in seconds. `0`
  means Immediately. Invalid values become `null` and are shown as N/A.
- `ScreenLockWindows`: valid values are `0` or `1`. `1` means logon required on
  resume, `0` means logon not required. Anything else becomes `null` and is
  shown as N/A.

Unknown device reads are pass-safe. If a command fails, times out, or returns an
unrecognized value, the read layer returns an unknown state and scan evaluation
passes that element rather than penalizing the user.

### macOS Screen Idle

Read the current-host screen saver idle time:

```sh
defaults -currentHost read com.apple.screensaver idleTime
```

Expected mapping:

- `0` -> Never
- positive integer -> duration in seconds
- blank, negative, non-integer, command failure -> unknown

With a valid policy, Never fails; a duration passes only when it is less than or
equal to the policy threshold.

### macOS Screen Lock

Prefer `sysadminctl`:

```sh
/usr/sbin/sysadminctl -screenLock status
```

Parse both stdout and stderr. Expected mapping:

- `screenLock delay is immediate` -> Immediately
- `screenLock delay is <N> second(s)` -> duration in seconds
- status text containing `disabled`, `never`, or `off` -> Never
- blank, unrecognized output, command failure -> fallback or unknown

If `sysadminctl` cannot produce a known state, fall back to:

```sh
defaults read com.apple.screensaver askForPassword
defaults read com.apple.screensaver askForPasswordDelay
```

Fallback expected mapping:

- `askForPassword = 0` -> Never
- `askForPassword = 1` and `askForPasswordDelay = 0` -> Immediately
- `askForPassword = 1` and positive delay -> duration in seconds
- blank, negative, non-integer, command failure -> unknown

With a valid policy, Immediately always passes, Never fails, and a duration
passes only when it is less than or equal to the policy threshold.

### Windows Screen Idle

Read screen saver settings from:

```powershell
Get-ItemProperty -Path "HKCU:\Control Panel\Desktop"
```

Use `ScreenSaveActive` and `ScreenSaveTimeOut`:

- `ScreenSaveActive = "0"` -> Never / disabled
- `ScreenSaveActive = "1"` and positive `ScreenSaveTimeOut` -> duration in
  seconds
- missing/null timeout, unrecognized values, command failure -> unknown

With a valid policy, Never / disabled fails; a duration passes only when it is
less than or equal to the policy threshold. This app intentionally treats
missing/null timeout values as unknown and pass-safe.

### Windows Screen Lock

Read the screen saver secure-on-resume setting from:

```powershell
Get-ItemProperty -Path "HKCU:\Control Panel\Desktop"
```

Use `ScreenSaverIsSecure`:

- `1` -> logon screen required on resume
- `0` -> logon screen not required on resume
- missing, unrecognized values, command failure -> unknown

With policy `1`, logon required passes and not required fails. With policy `0`,
the element always passes regardless of the device setting.

### Screen UI Labels

The scan result detail formats raw seconds and states into human-readable labels:

- invalid/null policy -> `N/A`
- Mac screen lock policy `0` or device delay `0` -> `Immediately`
- Never / disabled screen saver -> `Never`
- unknown reads -> `Unknown` or "could not be determined" detail text
- Windows lock states -> `Logon screen required on resume` or
  `Logon screen not required on resume`

## Network ID Check

The only check that makes an HTTP request rather than an OS call — fetches the device's public IP from an external service and compares against the policy IP list. Runs independently of OS checks.

Public IP lookup uses the documented fallback order:

1. `https://whatismyip.akamai.com`
2. `https://ifconfig.co/ip`

The detected public IP is submitted in the backend result field, but should not
be logged.

Network ID policy behavior preserves old application parity:

- `NetworkIDPolicy` PASS → PASS without enforcing the allowed-IP list
- `NetworkIDPolicy` FAIL/NUDGE and current IP is in `NetworkIDIPs` → PASS
- `NetworkIDPolicy` FAIL/NUDGE and current IP is not in `NetworkIDIPs` → FAIL/NUDGE
- `NetworkIDPolicy` FAIL/NUDGE and `NetworkIDIPs` is empty/null → FAIL/NUDGE
- Public IP lookup fails → PASS with an unknown message to avoid false alarms

`NetworkIDIPs` supports exact public IP values only, separated by commas.
Ranges and CIDR notation are intentionally not supported in v1.

## App Detection

Apps Policy detection is policy-targeted. The app reads only app names present in
the fetched prohibited-app and required-app policy lists, then checks those names
on the current platform.

Policy uses administrator-entered app names rather than App IDs / bundle IDs.
App IDs are more stable because users cannot rename them, but they are not
friendly for self-serve policy entry in the backend form. The old app originally
planned to show admins a predefined app-name list and save both app name and App
ID from a mapping sheet, but that made new apps dependent on a manual mapping
update. v1 preserves the later old-app behavior: admins type app names directly,
and DeviceWatch detects by app name.

App ID / bundle ID lookup remains useful for diagnostics and possible future
policy tooling, but it is not used for v1 app-policy enforcement.

### Mac

Mac uses Spotlight:

```sh
mdfind "kMDItemKind == 'Application' && kMDItemDisplayName == '<AppName>'c"
```

Policy entries may include a folder path, for example
`/Bitdefender/Antivirus for Mac`. The app splits this into:

- folder path: `/Bitdefender`
- app name: `Antivirus for Mac`

`mdfind` searches by app name. If a folder path was provided, the returned app
paths are filtered so the immediate parent directory ends with the configured
folder path, case-insensitively. If no folder path was provided, any matching
app path counts as installed.

Examples:

| Policy value                                  | Match behavior                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Antivirus for Mac`                           | Search for this app name anywhere Spotlight finds an application.                             |
| `/Bitdefender/Antivirus for Mac`              | Search for `Antivirus for Mac` where the parent path ends with `/Bitdefender`.                |
| `/Applications/Bitdefender/Antivirus for Mac` | Search for `Antivirus for Mac` directly under a path ending with `/Applications/Bitdefender`. |
| `/Applications/Antivirus for Mac`             | Search for `Antivirus for Mac` directly under a path ending with `/Applications`.             |

The path is treated as a suffix, not as a strict absolute root requirement. For
example, `/Bitdefender/Antivirus for Mac` can match
`/Applications/Bitdefender/Antivirus for Mac.app` or
`/Users/Shared/Bitdefender/Antivirus for Mac.app`. The recommended policy value
for vendor-specific Mac apps is usually a vendor folder suffix such as
`/Bitdefender/Antivirus for Mac`; this reduces conflicts with another vendor's
app using the same display name while still allowing installation in different
root locations.

Diagnostic examples for bundle ID lookup, not v1 enforcement:

```sh
mdls "/Applications/Google Chrome.app"
mdfind "kMDItemKind == 'Application' && kMDItemCFBundleIdentifier == 'com.google.Chrome'"
```

To inspect an installed app version manually, first locate the app with `mdfind`,
then run `mdls` on the returned `.app` path.

### Windows

Windows uses Start menu app entries:

```powershell
(Get-StartApps | Where-Object {$_.Name -eq '<AppName>'}).Name
```

Folder paths are not supported on Windows, matching old application behavior. If
a Windows policy app includes a folder path, it is treated as not installed.

Examples:

```powershell
(Get-StartApps | Where-Object {$_.Name -eq 'BitDefender'}).Name
```

Diagnostic examples for App ID lookup, not v1 enforcement:

```powershell
Get-StartApps | Where-Object {$_.AppID -eq 'chrome'}
(Get-StartApps | Where-Object {$_.AppID -eq 'Chrome'}).AppID
Get-StartApps | Where-Object {$_.AppID -eq 'avast! Antivirus'}
Get-StartApps | Where-Object {$_.AppID -eq 'eset.egui'}
```

### Unknown App Detection

App lookup command failures are represented as unknown and do not penalize the
scan:

- prohibited app unknown → treat as not installed for pass/fail evaluation, and
  show advisory text asking the user to make sure it is not installed
- required app unknown → count as satisfying the required-app count, and show
  advisory text asking the user to make sure it is installed

Policy app names are passed as command arguments through the shared command
runner rather than shell-concatenated.
