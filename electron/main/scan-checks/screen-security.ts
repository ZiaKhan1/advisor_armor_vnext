import { platform } from 'node:os'
import type { ScreenIdleState, ScreenLockState } from '@shared/models'
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

export async function readScreenLock(
  currentPlatform = platform()
): Promise<ScreenLockState> {
  if (currentPlatform === 'darwin') {
    return readMacScreenLock()
  }

  if (currentPlatform === 'win32') {
    return readWindowsScreenLock()
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

export function parseMacScreenLockState(
  askForPasswordOutput: string,
  askForPasswordDelayOutput: string
): ScreenLockState {
  const askForPassword = parseStrictInteger(askForPasswordOutput)

  if (askForPassword === 0) {
    return { kind: 'never' }
  }

  if (askForPassword !== 1) {
    return { kind: 'unknown' }
  }

  const delaySeconds = parseStrictInteger(askForPasswordDelayOutput)

  if (delaySeconds == null || delaySeconds < 0) {
    return { kind: 'unknown' }
  }

  if (delaySeconds === 0) {
    return { kind: 'immediately' }
  }

  return { kind: 'seconds', seconds: delaySeconds }
}

export function parseMacScreenLockStatus(output: string): ScreenLockState {
  if (/screenLock delay is immediate/i.test(output)) {
    return { kind: 'immediately' }
  }

  const delayMatch = output.match(/screenLock delay is (\d+) seconds?/i)
  if (delayMatch) {
    return { kind: 'seconds', seconds: Number.parseInt(delayMatch[1], 10) }
  }

  // On one machine, when setting was set to "Never", the "sysadminctl -screenLock status" returned  "screenLock is off".
  // However, sysadminctl does not document this behavior, so we are checking defensively.

  // Reutrn true when output contains one of these case-insensitive substrings:
  // screenLock disabled
  // screenLock never
  // screenLock off
  // screenLock is disabled
  // screenLock is never
  // screenLock is off
  // screenLock delay is disabled
  // screenLock delay is never
  // screenLock delay is off
  if (/screenLock (?:(?:delay )?is )?(?:disabled|never|off)/i.test(output)) {
    return { kind: 'never' }
  }

  return { kind: 'unknown' }
}

export function parseWindowsScreenLockState(output: string): ScreenLockState {
  const trimmed = output.trim()

  if (!trimmed || /^unknown$/i.test(trimmed)) {
    return { kind: 'unknown' }
  }

  if (/^(secure|1)$/i.test(trimmed)) {
    return { kind: 'required' }
  }

  if (/^(not_secure|0)$/i.test(trimmed)) {
    return { kind: 'notRequired' }
  }

  return { kind: 'unknown' }
}

function parseStrictInteger(output: string): number | null {
  const trimmed = output.trim()
  const value = Number.parseInt(trimmed, 10)

  if (Number.isNaN(value) || String(value) !== trimmed) {
    return null
  }

  return value
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

async function readMacScreenLock(): Promise<ScreenLockState> {
  // First try sysadminctl command which is on never mac os versions
  const screenLockResult = await runCommand(
    '/usr/sbin/sysadminctl',
    ['-screenLock', 'status'],
    SCREEN_SECURITY_COMMAND_TIMEOUT_MS
  )

  if (screenLockResult.ok) {
    // Observed on macOS 15.6.1: the status line is on stderr, while stdout may
    // contain unrelated aks output. Parse both streams.
    const state = parseMacScreenLockStatus(
      `${screenLockResult.stdout}\n${screenLockResult.stderr}`
    )
    if (state.kind !== 'unknown') {
      return state
    }

    logger.warn('Unable to parse macOS sysadminctl screen lock state', {
      stdout: screenLockResult.stdout,
      stderr: screenLockResult.stderr
    })
  }

  // Fallback for older systems and managed screen saver payloads that expose
  // askForPassword and askForPasswordDelay in com.apple.screensaver.
  const askForPasswordResult = await runCommand(
    'defaults',
    ['read', 'com.apple.screensaver', 'askForPassword'],
    SCREEN_SECURITY_COMMAND_TIMEOUT_MS
  )

  if (!askForPasswordResult.ok) {
    return { kind: 'unknown' }
  }

  const askForPasswordDelayResult = await runCommand(
    'defaults',
    ['read', 'com.apple.screensaver', 'askForPasswordDelay'],
    SCREEN_SECURITY_COMMAND_TIMEOUT_MS
  )

  if (!askForPasswordDelayResult.ok) {
    return { kind: 'unknown' }
  }

  const state = parseMacScreenLockState(
    askForPasswordResult.stdout,
    askForPasswordDelayResult.stdout
  )
  if (state.kind === 'unknown') {
    logger.warn('Unable to parse macOS screen lock state', {
      askForPasswordStdout: askForPasswordResult.stdout,
      askForPasswordDelayStdout: askForPasswordDelayResult.stdout
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

async function readWindowsScreenLock(): Promise<ScreenLockState> {
  const script = `
$ss = Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -ErrorAction Stop
$value = [string]$ss.ScreenSaverIsSecure
if ($value -eq "1") {
  Write-Output "SECURE"
  exit 0
}
if ($value -eq "0") {
  Write-Output "NOT_SECURE"
  exit 0
}
Write-Output "UNKNOWN"
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

  const state = parseWindowsScreenLockState(result.stdout)
  if (state.kind === 'unknown') {
    logger.warn('Unable to parse Windows screen lock state', {
      stdout: result.stdout
    })
  }

  return state
}
