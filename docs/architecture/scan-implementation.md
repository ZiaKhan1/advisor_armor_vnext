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

### Windows

Windows uses Start menu app entries:

```powershell
(Get-StartApps | Where-Object {$_.Name -eq '<AppName>'}).Name
```

Folder paths are not supported on Windows, matching old application behavior. If
a Windows policy app includes a folder path, it is treated as not installed.

### Unknown App Detection

App lookup command failures are represented as unknown and do not penalize the
scan:

- prohibited app unknown → treat as not installed for pass/fail evaluation, and
  show advisory text asking the user to make sure it is not installed
- required app unknown → count as satisfying the required-app count, and show
  advisory text asking the user to make sure it is installed

Policy app names are passed as command arguments through the shared command
runner rather than shell-concatenated.
