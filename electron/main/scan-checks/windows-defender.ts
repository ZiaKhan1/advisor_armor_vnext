import { platform } from 'node:os'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const WINDOWS_DEFENDER_TIMEOUT_MS = 10_000

export async function readWindowsDefenderEnabled(
  currentPlatform = platform()
): Promise<boolean | null> {
  if (currentPlatform !== 'win32') {
    return null
  }

  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '(Get-MpPreference).DisableRealtimeMonitoring'
    ],
    WINDOWS_DEFENDER_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  const enabled = parseWindowsDefenderState(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse Windows Defender Antivirus state', {
      stdout: result.stdout
    })
  }

  return enabled
}

export function parseWindowsDefenderState(output: string): boolean | null {
  const normalized = output.trim().toLowerCase()

  if (normalized === 'false') {
    return true
  }

  if (normalized === 'true') {
    return false
  }

  if (normalized === '0') {
    return true
  }

  if (normalized === '1') {
    return false
  }

  return null
}
