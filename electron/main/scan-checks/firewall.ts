import { platform } from 'node:os'
import { logger } from '../logging'
import { runCommand } from '../command-runner'

const FIREWALL_COMMAND_TIMEOUT_MS = 10_000

export async function readFirewallEnabled(
  currentPlatform = platform()
): Promise<boolean | null> {
  if (currentPlatform === 'darwin') {
    return readMacFirewallEnabled()
  }

  if (currentPlatform === 'win32') {
    return readWindowsFirewallEnabled()
  }

  return null
}

export function parseMacFirewallState(output: string): boolean | null {
  const normalized = output.toLowerCase()

  if (/\bstate\s*=\s*1\b/.test(normalized)) {
    return true
  }

  if (/\bstate\s*=\s*0\b/.test(normalized)) {
    return false
  }

  if (/\b(enabled|on)\b/.test(normalized)) {
    return true
  }

  if (/\b(disabled|off)\b/.test(normalized)) {
    return false
  }

  return null
}

export function parseWindowsFirewallState(output: string): boolean | null {
  const trimmed = output.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const profiles = Array.isArray(parsed) ? parsed : [parsed]
    const enabledValues = profiles
      .map((profile) =>
        profile && typeof profile === 'object'
          ? (profile as { Enabled?: unknown }).Enabled
          : undefined
      )
      .filter((enabled): enabled is boolean => typeof enabled === 'boolean')

    if (enabledValues.length === 0) {
      return null
    }

    return enabledValues.every(Boolean)
  } catch {
    return parseWindowsFirewallTextState(trimmed)
  }
}

function parseWindowsFirewallTextState(output: string): boolean | null {
  const matches = [...output.matchAll(/\bEnabled\s*:\s*(True|False)\b/gi)]

  if (matches.length === 0) {
    return null
  }

  return matches.every((match) => match[1].toLowerCase() === 'true')
}

async function readMacFirewallEnabled(): Promise<boolean | null> {
  const result = await runCommand(
    '/usr/libexec/ApplicationFirewall/socketfilterfw',
    ['--getglobalstate'],
    FIREWALL_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  const enabled = parseMacFirewallState(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse macOS firewall state', {
      stdout: result.stdout
    })
  }

  return enabled
}

async function readWindowsFirewallEnabled(): Promise<boolean | null> {
  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json -Compress'
    ],
    FIREWALL_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  const enabled = parseWindowsFirewallState(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse Windows firewall state', {
      stdout: result.stdout
    })
  }

  return enabled
}
