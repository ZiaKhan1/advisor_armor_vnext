import { platform } from 'node:os'
import type { ScreenIdleState } from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const SCREEN_SECURITY_COMMAND_TIMEOUT_MS = 10_000

export async function readScreenIdle(
  currentPlatform = platform()
): Promise<ScreenIdleState> {
  if (currentPlatform === 'darwin') {
    return readMacScreenIdle()
  }

  if (currentPlatform === 'win32') {
    return readWindowsScreenIdle()
  }

  return { kind: 'unknown' }
}

export function parseMacScreenIdleState(output: string): ScreenIdleState {
  const trimmed = output.trim()

  if (!trimmed) {
    return { kind: 'unknown' }
  }

  const seconds = Number.parseInt(trimmed, 10)
  if (Number.isNaN(seconds) || String(seconds) !== trimmed) {
    return { kind: 'unknown' }
  }

  if (seconds === 0) {
    return { kind: 'never' }
  }

  if (seconds > 0) {
    return { kind: 'seconds', seconds }
  }

  return { kind: 'unknown' }
}

export function parseWindowsScreenIdleState(output: string): ScreenIdleState {
  const trimmed = output.trim()

  if (!trimmed || /^unknown$/i.test(trimmed)) {
    return { kind: 'unknown' }
  }

  if (/^never$/i.test(trimmed)) {
    return { kind: 'never' }
  }

  const seconds = Number.parseInt(trimmed, 10)
  if (Number.isNaN(seconds) || String(seconds) !== trimmed) {
    return { kind: 'unknown' }
  }

  if (seconds === 0) {
    return { kind: 'never' }
  }

  if (seconds > 0) {
    return { kind: 'seconds', seconds }
  }

  return { kind: 'unknown' }
}

async function readMacScreenIdle(): Promise<ScreenIdleState> {
  const result = await runCommand(
    'defaults',
    ['-currentHost', 'read', 'com.apple.screensaver', 'idleTime'],
    SCREEN_SECURITY_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return { kind: 'unknown' }
  }

  const state = parseMacScreenIdleState(result.stdout)
  if (state.kind === 'unknown') {
    logger.warn('Unable to parse macOS screen idle state', {
      stdout: result.stdout
    })
  }

  return state
}

async function readWindowsScreenIdle(): Promise<ScreenIdleState> {
  const script = `
$ss = Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -ErrorAction Stop
$active = [string]$ss.ScreenSaveActive
if ($active -eq "0") {
  Write-Output "NEVER"
  exit 0
}
if ($active -ne "1") {
  Write-Output "UNKNOWN"
  exit 0
}
$timeout = $ss.ScreenSaveTimeOut
if ($null -eq $timeout) {
  Write-Output "UNKNOWN"
  exit 0
}
Write-Output $timeout
`

  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ],
    SCREEN_SECURITY_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return { kind: 'unknown' }
  }

  const state = parseWindowsScreenIdleState(result.stdout)
  if (state.kind === 'unknown') {
    logger.warn('Unable to parse Windows screen idle state', {
      stdout: result.stdout
    })
  }

  return state
}
