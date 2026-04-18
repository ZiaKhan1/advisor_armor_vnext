import { access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { platform } from 'node:os'
import type {
  ActiveWifiAssessment,
  WifiSecurityReason,
  WifiSecurityStatus
} from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const ACTIVE_WIFI_TIMEOUT_MS = 10_000

export interface ActiveWifiFacts {
  ssid?: string
  security?: string
  securityRawValue?: number
  authentication?: string
  cipher?: string
}

export interface ActiveWifiSnapshot {
  facts: ActiveWifiFacts
  assessment: ActiveWifiAssessment
}

interface Classification {
  status: WifiSecurityStatus
  reason: WifiSecurityReason
  detail: string
}

const UNKNOWN_ASSESSMENT: ActiveWifiAssessment = {
  status: 'unknown',
  reason: 'unknown',
  securityLabel: 'Unknown',
  detail: 'Current Wi-Fi security could not be determined.'
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
        : UNKNOWN_ASSESSMENT

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

export function classifyMacWifiSecurity(
  facts: ActiveWifiFacts
): ActiveWifiAssessment {
  const securityRawValue = facts.securityRawValue
  const securityLabel = facts.security ?? 'Unknown'
  const classification = classifyMacSecurityRawValue(securityRawValue)

  return buildAssessment(facts, securityLabel, classification)
}

export function classifyWindowsWifiSecurity(
  facts: ActiveWifiFacts
): ActiveWifiAssessment {
  const authentication = facts.authentication ?? ''
  const cipher = facts.cipher ?? ''
  const securityLabel = [authentication, cipher].filter(Boolean).join(' / ')
  const classification = classifyWindowsSecurity(authentication, cipher)

  return buildAssessment(facts, securityLabel || 'Unknown', classification)
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

function classifyMacSecurityRawValue(
  securityRawValue: number | undefined
): Classification {
  switch (securityRawValue) {
    case 0:
      return {
        status: 'insecure',
        reason: 'no-password',
        detail: 'Current Wi-Fi does not require a password.'
      }
    case 1:
    case 6:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        detail: 'Current Wi-Fi uses outdated WEP security.'
      }
    case 2:
    case 7:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        detail: 'Current Wi-Fi uses outdated WPA security.'
      }
    case 3:
    case 8:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        detail: 'Current Wi-Fi allows older WPA security.'
      }
    case 4:
    case 9:
    case 11:
    case 12:
    case 13:
      return {
        status: 'secure',
        reason: 'modern-protocol',
        detail: 'Current Wi-Fi uses a modern security mode.'
      }
    case 14:
      return {
        status: 'insecure',
        reason: 'no-password',
        detail:
          'Current Wi-Fi uses Enhanced Open, which does not require a password.'
      }
    case 15:
      return {
        status: 'insecure',
        reason: 'no-password',
        detail: 'Current Wi-Fi allows a no-password connection mode.'
      }
    default:
      return {
        status: 'unknown',
        reason: 'unknown',
        detail: 'Current Wi-Fi security could not be determined.'
      }
  }
}

function classifyWindowsSecurity(
  authentication: string,
  cipher: string
): Classification {
  const normalizedAuth = normalizeSecurityValue(authentication)
  const normalizedCipher = normalizeSecurityValue(cipher)

  if (!normalizedAuth && !normalizedCipher) {
    return {
      status: 'unknown',
      reason: 'unknown',
      detail: 'Current Wi-Fi security could not be determined.'
    }
  }

  if (normalizedAuth === 'OPEN' || normalizedAuth === 'OWE') {
    return {
      status: 'insecure',
      reason: 'no-password',
      detail:
        normalizedAuth === 'OWE'
          ? 'Current Wi-Fi uses Enhanced Open, which does not require a password.'
          : 'Current Wi-Fi does not require a password.'
    }
  }

  if (
    normalizedAuth === 'SHAREDKEY' ||
    normalizedAuth.includes('WEP') ||
    ['WEP', 'WEP40', 'WEP104'].includes(normalizedCipher)
  ) {
    return {
      status: 'insecure',
      reason: 'weak-protocol',
      detail: 'Current Wi-Fi uses outdated WEP security.'
    }
  }

  if (
    normalizedAuth === 'WPA' ||
    normalizedAuth === 'WPAPSK' ||
    normalizedAuth === 'WPAPERSONAL' ||
    normalizedAuth === 'WPAENTERPRISE' ||
    normalizedCipher === 'TKIP'
  ) {
    return {
      status: 'insecure',
      reason: 'weak-protocol',
      detail: 'Current Wi-Fi uses a weak security mode.'
    }
  }

  if (
    normalizedAuth === 'RSNA' ||
    normalizedAuth === 'RSNAPSK' ||
    normalizedAuth === 'WPA2PERSONAL' ||
    normalizedAuth === 'WPA2ENTERPRISE' ||
    normalizedAuth === 'WPA2PSK'
  ) {
    return ['CCMP', 'CCMP256', 'GCMP', 'GCMP256'].includes(normalizedCipher)
      ? {
          status: 'secure',
          reason: 'modern-protocol',
          detail: 'Current Wi-Fi uses a modern security mode.'
        }
      : {
          status: 'unknown',
          reason: 'unknown',
          detail: 'Current Wi-Fi security could not be determined.'
        }
  }

  if (
    normalizedAuth === 'WPA3SAE' ||
    normalizedAuth === 'WPA3PERSONAL' ||
    normalizedAuth === 'WPA3ENTERPRISE' ||
    normalizedAuth === 'WPA3ENTERPRISE192BIT'
  ) {
    return {
      status: 'secure',
      reason: 'modern-protocol',
      detail: 'Current Wi-Fi uses a modern security mode.'
    }
  }

  return {
    status: 'unknown',
    reason: 'unknown',
    detail: 'Current Wi-Fi security could not be determined.'
  }
}

function buildAssessment(
  facts: ActiveWifiFacts,
  securityLabel: string,
  classification: Classification
): ActiveWifiAssessment {
  const ssidPrefix = facts.ssid
    ? `Current Wi-Fi "${facts.ssid}"`
    : 'Current Wi-Fi'
  const detail =
    classification.status === 'secure'
      ? `${ssidPrefix} uses a modern security mode: ${securityLabel}.`
      : classification.status === 'unknown'
        ? `${ssidPrefix} security could not be determined.`
        : `${ssidPrefix}${classification.detail.replace('Current Wi-Fi', '')}`

  return {
    status: classification.status,
    reason: classification.reason,
    securityLabel,
    detail
  }
}

function normalizeSecurityValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
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
