import { access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { platform } from 'node:os'
import type { ActiveWifiAssessment } from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'
import {
  classifyMacWifiSecurity,
  classifyWindowsWifiSecurity,
  UNKNOWN_CURRENT_WIFI_ASSESSMENT,
  type WifiSecurityFacts
} from './wifi-security'

export { classifyMacWifiSecurity, classifyWindowsWifiSecurity }

const ACTIVE_WIFI_TIMEOUT_MS = 10_000

export type ActiveWifiFacts = WifiSecurityFacts

export interface ActiveWifiSnapshot {
  facts: ActiveWifiFacts
  assessment: ActiveWifiAssessment
}

export async function readActiveWifiSnapshot(
  currentPlatform = platform()
): Promise<ActiveWifiSnapshot> {
  const facts =
    currentPlatform === 'darwin'
      ? await readMacActiveWifiFacts()
      : currentPlatform === 'win32'
        ? await readWindowsActiveWifiFacts()
        : {}

  const assessment =
    currentPlatform === 'darwin'
      ? classifyMacWifiSecurity(facts)
      : currentPlatform === 'win32'
        ? classifyWindowsWifiSecurity(facts)
        : UNKNOWN_CURRENT_WIFI_ASSESSMENT

  logger.info('Active Wi-Fi facts', {
    ssid: facts.ssid ?? null,
    security: facts.security ?? null,
    securityRawValue: facts.securityRawValue ?? null,
    authentication: facts.authentication ?? null,
    cipher: facts.cipher ?? null,
    classification: assessment.status,
    reason: assessment.reason
  })

  return {
    facts,
    assessment
  }
}

export function parseWindowsActiveWifiFacts(output: string): ActiveWifiFacts {
  const trimmed = output.trim()
  if (!trimmed) {
    return {}
  }

  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const values = parsed as Record<string, unknown>

  return {
    ssid: getString(values.SSID),
    authentication: getString(values.Authentication),
    cipher: getString(values.Cipher)
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function readMacActiveWifiFacts(): Promise<ActiveWifiFacts> {
  const helperPath = await getMacHelperPath()
  if (!helperPath) {
    logger.warn('macOS active Wi-Fi helper is missing')
    return {}
  }

  const result = await runCommand(helperPath, [], ACTIVE_WIFI_TIMEOUT_MS)
  if (!result.ok) {
    return {}
  }

  try {
    const parsed = JSON.parse(result.stdout) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const values = parsed as Record<string, unknown>
    return {
      ssid: getString(values.ssid),
      security: getString(values.security),
      securityRawValue:
        typeof values.securityRawValue === 'number'
          ? values.securityRawValue
          : undefined
    }
  } catch (error) {
    logger.warn('Unable to parse macOS active Wi-Fi helper output', {
      error,
      stdout: result.stdout.slice(0, 500)
    })
    return {}
  }
}

async function readWindowsActiveWifiFacts(): Promise<ActiveWifiFacts> {
  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '$h=@{}; netsh wlan show interface | % { $line = $_.Trim(); if ($line -match "(.+?)\\s*:\\s*(.+)") { $h[$matches[1].Trim()] = $matches[2].Trim() } }; $h | ConvertTo-Json -Compress -Depth 3'
    ],
    ACTIVE_WIFI_TIMEOUT_MS
  )

  if (!result.ok) {
    return {}
  }

  try {
    return parseWindowsActiveWifiFacts(result.stdout)
  } catch (error) {
    logger.warn('Unable to parse Windows active Wi-Fi output', {
      error,
      stdout: result.stdout.slice(0, 500)
    })
    return {}
  }
}

async function getMacHelperPath(): Promise<string | null> {
  const candidates = [
    join(process.resourcesPath ?? '', 'native/macos/wifi-active/wifi-active'),
    resolve('native/macos/wifi-active/dist/wifi-active')
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return null
}
