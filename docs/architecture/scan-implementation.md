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
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'])
    let output = ''
    ps.stdout.on('data', data => output += data)
    ps.stderr.on('data', data => reject(data.toString()))
    ps.on('close', () => resolve(output))
    ps.stdin.write(script)
    ps.stdin.end()
  })
}

function runShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sh = spawn('bash', ['-s'])
    let output = ''
    sh.stdout.on('data', data => output += data)
    sh.stderr.on('data', data => reject(data.toString()))
    sh.on('close', () => resolve(output))
    sh.stdin.write(script)
    sh.stdin.end()
  })
}
```

### Which to use
Default to `execFile`:

| Scenario | Tool |
|---|---|
| Simple Mac shell command | `execFile('bash', ['-lc', ...])` |
| Simple Windows command (`powershell.exe`, `netsh`, `reg query`) | `execFile(...)` |
| Complex multi-line PowerShell | `spawn` → `runPowerShell` |
| Complex multi-line bash | `spawn` → `runShell` |

## Platform Differences

Each scan element has a Mac and Windows implementation. Platform is detected via `os.platform()`:

```ts
import { platform } from 'os'

const isMac = platform() === 'darwin'
const isWindows = platform() === 'win32'
```

Mac checks use shell commands (`defaults read`, `fdesetup`, `socketfilterfw`, `system_profiler`, etc.).
Windows checks use PowerShell (`Get-NetFirewallProfile`, `Get-BitLockerVolume`, `Get-MpComputerStatus`, etc.), registry queries (`reg query`), or `netsh` for WiFi.

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

## App Detection

Uses `fs.existsSync` to check if an app exists at a given path. No child process needed.

- **Mac:** checks application path (e.g. `/Applications/AppName.app`)
- **Windows:** checks file path or registry — TBD at implementation
