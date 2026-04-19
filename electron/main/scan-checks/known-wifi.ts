import { access } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import type {
  KnownWifiAssessment,
  KnownWifiNetworkAssessment,
  WifiSecurityAssessment
} from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'
import {
  classifyMacWifiSecurity,
  classifyWindowsKnownWifiSecurity
} from './wifi-security'

const KNOWN_WIFI_TIMEOUT_MS = 20_000

export interface MacKnownWifiProfile {
  ssid?: string
  security?: string
  securityRawValue?: number
}

export interface WindowsKnownWifiProfile {
  profileName?: string
  ssid?: string
  authentication: string[]
  cipher: string[]
}

export type KnownWifiProfile = MacKnownWifiProfile | WindowsKnownWifiProfile

export interface KnownWifiSnapshot {
  profiles: KnownWifiProfile[]
  assessment: KnownWifiAssessment
}

export async function readKnownWifiSnapshot(
  currentPlatform = platform()
): Promise<KnownWifiSnapshot> {
  const profiles =
    currentPlatform === 'darwin'
      ? await readMacKnownWifiProfiles()
      : currentPlatform === 'win32'
        ? await readWindowsKnownWifiProfiles()
        : null

  const assessment =
    profiles == null
      ? buildUnknownAssessment()
      : currentPlatform === 'darwin'
        ? assessMacKnownWifiProfiles(profiles)
        : currentPlatform === 'win32'
          ? assessWindowsKnownWifiProfiles(profiles)
          : buildUnknownAssessment()

  logger.info('Known Wi-Fi facts', {
    platform: currentPlatform,
    profileCount: profiles?.length ?? null,
    insecureCount: assessment.insecureNetworks.length,
    classification: assessment.status,
    networks:
      profiles?.map((profile) => {
        const assessment = assessKnownWifiProfile(currentPlatform, profile)
        return {
          ssid: profile.ssid ?? null,
          profileName:
            'profileName' in profile ? (profile.profileName ?? null) : null,
          security: 'security' in profile ? (profile.security ?? null) : null,
          securityRawValue:
            'securityRawValue' in profile
              ? (profile.securityRawValue ?? null)
              : null,
          authentication:
            'authentication' in profile ? profile.authentication : null,
          cipher: 'cipher' in profile ? profile.cipher : null,
          classification: assessment.status,
          reason: assessment.reason
        }
      }) ?? null
  })

  return {
    profiles: profiles ?? [],
    assessment
  }
}

export function assessMacKnownWifiProfiles(
  profiles: KnownWifiProfile[]
): KnownWifiAssessment {
  return buildKnownWifiAssessment(
    profiles.map((profile) => toKnownWifiNetwork(profile, 'darwin'))
  )
}

export function assessWindowsKnownWifiProfiles(
  profiles: KnownWifiProfile[]
): KnownWifiAssessment {
  return buildKnownWifiAssessment(
    profiles.map((profile) => toKnownWifiNetwork(profile, 'win32'))
  )
}

export function parseMacKnownWifiProfiles(
  output: string
): MacKnownWifiProfile[] {
  const trimmed = output.trim()
  if (!trimmed) {
    return []
  }

  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return []
  }

  const values = parsed as Record<string, unknown>
  if (typeof values.error === 'string') {
    throw new Error(values.error)
  }

  const knownNetworks = Array.isArray(values.knownNetworks)
    ? values.knownNetworks
    : []

  return knownNetworks
    .filter(
      (network): network is Record<string, unknown> =>
        !!network && typeof network === 'object' && !Array.isArray(network)
    )
    .map((network) => ({
      ssid: getString(network.ssid),
      security: getString(network.security),
      securityRawValue:
        typeof network.securityRawValue === 'number'
          ? network.securityRawValue
          : undefined
    }))
}

export function parseWindowsKnownWifiProfiles(
  output: string
): WindowsKnownWifiProfile[] {
  const trimmed = output.trim()
  if (!trimmed) {
    return []
  }

  const parsed = JSON.parse(trimmed) as unknown
  const profiles = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? [parsed]
      : []

  return profiles
    .filter(
      (profile): profile is Record<string, unknown> =>
        !!profile && typeof profile === 'object' && !Array.isArray(profile)
    )
    .map((profile) => ({
      profileName: getString(profile.ProfileName),
      ssid: getString(profile.SSID),
      authentication: getStringArray(profile.Authentication),
      cipher: getStringArray(profile.Cipher)
    }))
}

function buildKnownWifiAssessment(
  networks: KnownWifiNetworkAssessment[]
): KnownWifiAssessment {
  const insecureNetworks = networks.filter(
    (network) => network.status === 'insecure'
  )

  if (insecureNetworks.length > 0) {
    return {
      status: 'insecure',
      detail: 'This device remembers one or more insecure Wi-Fi networks.',
      networkCount: networks.length,
      insecureNetworks
    }
  }

  return {
    status: 'secure',
    detail: 'No insecure saved Wi-Fi networks were found on this device.',
    networkCount: networks.length,
    insecureNetworks: []
  }
}

function buildUnknownAssessment(): KnownWifiAssessment {
  return {
    status: 'unknown',
    detail: 'Saved Wi-Fi networks could not be checked.',
    networkCount: 0,
    insecureNetworks: []
  }
}

function toKnownWifiNetwork(
  profile: KnownWifiProfile,
  currentPlatform: string
): KnownWifiNetworkAssessment {
  const assessment = assessKnownWifiProfile(currentPlatform, profile)

  return {
    ssid: profile.ssid || 'Unknown Wi-Fi network',
    profileName: 'profileName' in profile ? profile.profileName : undefined,
    status: assessment.status,
    reason: assessment.reason,
    reasonText: assessment.reasonText,
    securityLabel: assessment.securityLabel
  }
}

function assessKnownWifiProfile(
  currentPlatform: string,
  profile: KnownWifiProfile
): WifiSecurityAssessment {
  if (currentPlatform === 'darwin') {
    return classifyMacWifiSecurity(
      {
        ssid: profile.ssid,
        security: 'security' in profile ? profile.security : undefined,
        securityRawValue:
          'securityRawValue' in profile ? profile.securityRawValue : undefined
      },
      'Saved Wi-Fi network'
    )
  }

  if (currentPlatform === 'win32') {
    return classifyWindowsKnownWifiSecurity(
      {
        ssid: profile.ssid,
        authentication:
          'authentication' in profile ? profile.authentication : undefined,
        cipher: 'cipher' in profile ? profile.cipher : undefined
      },
      'Saved Wi-Fi network'
    )
  }

  return {
    status: 'unknown',
    reason: 'unknown',
    reasonText: 'security could not be determined',
    securityLabel: 'Unknown',
    detail: 'Saved Wi-Fi network security could not be determined.'
  }
}

async function readMacKnownWifiProfiles(): Promise<
  MacKnownWifiProfile[] | null
> {
  const helperPath = await getMacHelperPath()
  if (!helperPath) {
    logger.warn('macOS known Wi-Fi helper is missing')
    return null
  }

  const result = await runCommand(helperPath, [], KNOWN_WIFI_TIMEOUT_MS)
  if (!result.ok) {
    return null
  }

  try {
    return parseMacKnownWifiProfiles(result.stdout)
  } catch (error) {
    logger.warn('Unable to parse macOS known Wi-Fi helper output', {
      error,
      stdout: result.stdout.slice(0, 500)
    })
    return null
  }
}

async function readWindowsKnownWifiProfiles(): Promise<
  WindowsKnownWifiProfile[] | null
> {
  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '$profiles=netsh wlan show profiles | Select-String "All User Profile" | % { $_.ToString().Split(":",2)[1].Trim() }; $out=@(); foreach ($p in $profiles) { $details=netsh wlan show profile name="$p"; $ssidLine=$details | Select-String "SSID name"; $ssid=if ($ssidLine) { $ssidLine.ToString().Split(":",2)[1].Trim().Trim("`"") } else { "" }; $authArray=@(); $authLines=$details | Select-String "Authentication"; foreach ($line in $authLines) { $authArray += $line.ToString().Split(":",2)[1].Trim().Trim("`"") }; $cipherArray=@(); $cipherLines=$details | Select-String "Cipher"; foreach ($line in $cipherLines) { $cipherArray += $line.ToString().Split(":",2)[1].Trim().Trim("`"") }; $out += [pscustomobject]@{ProfileName=$p;SSID=$ssid;Authentication=$authArray;Cipher=$cipherArray} }; $out | ConvertTo-Json -Compress -Depth 5'
    ],
    KNOWN_WIFI_TIMEOUT_MS
  )

  if (!result.ok) {
    return null
  }

  try {
    return parseWindowsKnownWifiProfiles(result.stdout)
  } catch (error) {
    logger.warn('Unable to parse Windows known Wi-Fi output', {
      error,
      stdout: result.stdout.slice(0, 500)
    })
    return null
  }
}

async function getMacHelperPath(): Promise<string | null> {
  const candidates = [
    join(process.resourcesPath ?? '', 'native/macos/wifi-known/wifi-known'),
    resolve('native/macos/wifi-known/dist/wifi-known')
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

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return typeof value === 'string' && value.trim() ? [value.trim()] : []
}
