import { platform } from 'node:os'
import type {
  AutomaticUpdateCheck,
  AutomaticUpdatesSnapshot
} from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const AUTOMATIC_UPDATES_COMMAND_TIMEOUT_MS = 10_000
const TAHOE_MIN_VERSION = '26.0.1'

interface MacAutomaticUpdateSetting {
  key: string
  label: string
  domain: string
  preferenceKeys: string[]
}

const MAC_SOFTWARE_UPDATE_DOMAIN =
  '/Library/Preferences/com.apple.SoftwareUpdate'
const MAC_COMMERCE_DOMAIN = '/Library/Preferences/com.apple.commerce'

const MAC_AUTOMATIC_UPDATE_SETTINGS: MacAutomaticUpdateSetting[] = [
  {
    key: 'automaticCheckEnabled',
    label: 'Check for updates',
    domain: MAC_SOFTWARE_UPDATE_DOMAIN,
    preferenceKeys: ['AutomaticCheckEnabled']
  },
  {
    key: 'automaticDownloadUpdates',
    label: 'Download new updates when available',
    domain: MAC_SOFTWARE_UPDATE_DOMAIN,
    preferenceKeys: ['AutomaticDownload']
  },
  {
    key: 'automaticOsUpdates',
    label: 'Install macOS updates',
    domain: MAC_SOFTWARE_UPDATE_DOMAIN,
    preferenceKeys: ['AutomaticallyInstallMacOSUpdates']
  },
  {
    key: 'automaticAppUpdates',
    label: 'Install application updates from the App Store',
    domain: MAC_COMMERCE_DOMAIN,
    preferenceKeys: ['AutoUpdate']
  },
  {
    key: 'automaticSecurityUpdates',
    label: 'Install Security Responses and system files',
    domain: MAC_SOFTWARE_UPDATE_DOMAIN,
    preferenceKeys: ['CriticalUpdateInstall', 'ConfigDataInstall']
  }
]

export async function readAutomaticUpdates(
  currentPlatform = platform()
): Promise<AutomaticUpdatesSnapshot> {
  if (currentPlatform === 'darwin') {
    return readMacAutomaticUpdates()
  }

  if (currentPlatform === 'win32') {
    return readWindowsAutomaticUpdates()
  }

  return createUnknownSnapshot()
}

export function evaluateAutomaticUpdateChecks(
  checks: AutomaticUpdateCheck[]
): boolean | null {
  if (checks.some((check) => check.enabled === false)) {
    return false
  }

  if (checks.length > 0 && checks.every((check) => check.enabled === true)) {
    return true
  }

  return null
}

export function parseMacPreferenceBoolean(output: string): boolean | null {
  const normalized = output.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return null
}

export function compareSemanticVersion(left: string, right: string): number {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0
    const rightValue = rightParts[index] ?? 0

    if (leftValue > rightValue) {
      return 1
    }

    if (leftValue < rightValue) {
      return -1
    }
  }

  return 0
}

export function isMojaveOrLater(version: string): boolean | null {
  if (!version.trim()) {
    return null
  }

  return compareSemanticVersion(version, '10.14') >= 0
}

export function isTahoeOrLater(version: string): boolean | null {
  if (!version.trim()) {
    return null
  }

  return compareSemanticVersion(version, TAHOE_MIN_VERSION) >= 0
}

export function parseWindowsPauseUpdatesExpiryTime(
  output: string,
  now = new Date()
): boolean | null {
  const trimmed = output.trim()

  if (!trimmed) {
    return true
  }

  const expiry = new Date(trimmed)
  if (Number.isNaN(expiry.getTime())) {
    return null
  }

  return expiry > now ? false : true
}

async function readMacAutomaticUpdates(): Promise<AutomaticUpdatesSnapshot> {
  const version = await readMacOsVersion()
  const checks = await Promise.all(
    MAC_AUTOMATIC_UPDATE_SETTINGS.map(async (setting) => ({
      key: setting.key,
      label: setting.label,
      enabled: await readMacPreference(setting)
    }))
  )

  return {
    enabled: evaluateAutomaticUpdateChecks(checks),
    checks,
    mojaveOrLater: version ? isMojaveOrLater(version) : null,
    tahoeOrLater: version ? isTahoeOrLater(version) : null
  }
}

async function readMacOsVersion(): Promise<string | null> {
  const result = await runCommand(
    'sw_vers',
    ['-productVersion'],
    AUTOMATIC_UPDATES_COMMAND_TIMEOUT_MS
  )

  if (!result.ok || !result.stdout.trim()) {
    logger.warn('Unable to read macOS product version')
    return null
  }

  return result.stdout.trim()
}

async function readMacPreference(
  setting: MacAutomaticUpdateSetting
): Promise<boolean | null> {
  const values = await Promise.all(
    setting.preferenceKeys.map((preferenceKey) =>
      readMacPreferenceKey(setting.domain, preferenceKey)
    )
  )

  if (values.some((value) => value === false)) {
    return false
  }

  if (values.every((value) => value === true)) {
    return true
  }

  return null
}

async function readMacPreferenceKey(
  domain: string,
  preferenceKey: string
): Promise<boolean | null> {
  const result = await runCommand(
    'defaults',
    ['read', domain, preferenceKey],
    AUTOMATIC_UPDATES_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    logger.warn('Unable to read macOS automatic update setting', {
      key: preferenceKey
    })
    return null
  }

  const enabled = parseMacPreferenceBoolean(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse macOS automatic update setting', {
      key: preferenceKey,
      stdout: result.stdout
    })
  }

  return enabled
}

async function readWindowsAutomaticUpdates(): Promise<AutomaticUpdatesSnapshot> {
  const script = `
$value = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -ErrorAction Stop).PauseUpdatesExpiryTime
if ($null -eq $value) {
  Write-Output ''
} else {
  Write-Output $value
}
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
    AUTOMATIC_UPDATES_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return createUnknownSnapshot([
      {
        key: 'windowsUpdatesNotPaused',
        label: 'Windows updates are not paused',
        enabled: null
      }
    ])
  }

  const enabled = parseWindowsPauseUpdatesExpiryTime(result.stdout)
  if (enabled == null) {
    logger.warn('Unable to parse Windows automatic update setting', {
      stdout: result.stdout
    })
  }

  const checks = [
    {
      key: 'windowsUpdatesNotPaused',
      label: 'Windows updates are not paused',
      enabled
    }
  ]

  return {
    enabled: evaluateAutomaticUpdateChecks(checks),
    checks,
    mojaveOrLater: null,
    tahoeOrLater: null
  }
}

function createUnknownSnapshot(
  checks: AutomaticUpdateCheck[] = []
): AutomaticUpdatesSnapshot {
  return {
    enabled: null,
    checks,
    mojaveOrLater: null,
    tahoeOrLater: null
  }
}

function parseVersionParts(value: string): number[] {
  return value
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => !Number.isNaN(part))
}
