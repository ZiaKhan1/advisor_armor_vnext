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

Two tools from Node.js `child_process`, chosen per check based on complexity:

### `exec` — simple commands
From `child_process/promises`. Buffers output and returns when process completes. Best for simple commands with small, predictable output.

```ts
import { exec } from 'child_process/promises'

const { stdout } = await exec('fdesetup status')
// stdout = "FileVault is On."
```

### `spawn` — complex scripts
From `child_process`. Streams output and supports writing to stdin. Used when the script is multi-line or complex — script is piped via stdin to avoid shell escaping issues.

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
The choice is case by case depending on the command:

| Scenario | Tool |
|---|---|
| Simple Mac shell command | `exec` |
| Simple Windows command (`netsh`, `reg query`) | `exec` |
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

## Network ID Check

The only check that makes an HTTP request rather than an OS call — fetches the device's public IP from an external service and compares against the policy IP list. Runs independently of OS checks.

## App Detection

Uses `fs.existsSync` to check if an app exists at a given path. No child process needed.

- **Mac:** checks application path (e.g. `/Applications/AppName.app`)
- **Windows:** checks file path or registry — TBD at implementation
