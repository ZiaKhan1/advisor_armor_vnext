import { platform } from 'node:os'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const REMOTE_LOGIN_COMMAND_TIMEOUT_MS = 10_000

export async function readRemoteLoginEnabled(
  currentPlatform = platform()
): Promise<boolean | null> {
  if (currentPlatform === 'darwin') {
    return readMacRemoteLoginEnabled()
  }

  if (currentPlatform === 'win32') {
    return readWindowsRemoteLoginEnabled()
  }

  return null
}

export function parseMacRemoteLoginNetstatState(
  output: string
): boolean | null {
  const trimmed = output.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.split(/\r?\n/).some((line) => isRemoteLoginListenerLine(line))
}

export function parseWindowsRemoteLoginState(output: string): boolean | null {
  const trimmed = output.trim()

  if (!trimmed) {
    return null
  }

  const value = Number.parseInt(trimmed, 10)
  if (Number.isNaN(value)) {
    return null
  }

  if (value === 0) {
    return true
  }

  if (value === 1) {
    return false
  }

  return null
}

function isRemoteLoginListenerLine(line: string): boolean {
  const normalized = line.trim().toLowerCase()

  if (!normalized.includes('listen')) {
    return false
  }

  const columns = normalized.split(/\s+/)
  return columns.some((column) => isRemoteLoginAddress(column))
}

function isRemoteLoginAddress(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, '')

  return (
    /(^|\.)\*(\.|:)(22|23)$/.test(address) ||
    /(^|\.)0\.0\.0\.0\.(22|23)$/.test(address) ||
    /(^|\.)::\.(22|23)$/.test(address) ||
    /(^|\.):::(22|23)$/.test(address)
  )
}

async function readMacRemoteLoginEnabled(): Promise<boolean | null> {
  const result = await runCommand(
    'netstat',
    ['-anv'],
    REMOTE_LOGIN_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  const enabled = parseMacRemoteLoginNetstatState(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse macOS remote login state', {
      stdout: result.stdout
    })
  }

  return enabled
}

async function readWindowsRemoteLoginEnabled(): Promise<boolean | null> {
  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "(Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -ErrorAction Stop).fDenyTSConnections"
    ],
    REMOTE_LOGIN_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  const enabled = parseWindowsRemoteLoginState(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse Windows remote login state', {
      stdout: result.stdout
    })
  }

  return enabled
}
