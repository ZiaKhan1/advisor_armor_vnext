import type { NormalizedPolicy, RequiredAppsCategory } from '@shared/models'
import { PASS, toPolicyStatus } from '@shared/status'

function convertToInt(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number.parseInt(value, 10)
  }
  return Number.NaN
}

function convertToIntOrNull(value: unknown, minAllowedValue: number): number | null {
  const intValue = convertToInt(value)
  if (Number.isNaN(intValue)) {
    return null
  }
  return intValue < minAllowedValue ? null : intValue
}

function getProhibitedApps(appPolicy: unknown): string[] {
  const apps = (appPolicy as { prohibitedApps?: Array<{ AppName?: string | null }> } | undefined)
    ?.prohibitedApps
  if (!apps) {
    return []
  }
  return apps
    .filter(app => app.AppName != null)
    .map(app => app.AppName!.trim())
}

function getRequiredAppsCategories(appPolicy: unknown): RequiredAppsCategory[] {
  const categories = (
    appPolicy as
      | { requiredAppsCategories?: Array<{ apps?: Array<{ AppName?: string }>; requiredAppsCount?: string | number }> }
      | undefined
  )?.requiredAppsCategories
  if (!categories) {
    return []
  }
  return categories
    .filter(
      category =>
        Array.isArray(category.apps) &&
        category.apps.length > 0 &&
        Number(category.requiredAppsCount) > 0
    )
    .map(category => ({
      apps: category.apps!.map(app => app.AppName?.trim() ?? '').filter(Boolean),
      requiredAppsCount: Number(category.requiredAppsCount)
    }))
}

export function parsePolicyResponse(userPolicy: Record<string, unknown>, isMacOS: boolean): NormalizedPolicy {
  const systemPolicy = (userPolicy.systemPolicy ?? {}) as Record<string, unknown>
  const appPolicy = (
    isMacOS
      ? (userPolicy.AppPolicy as { macPolicy?: unknown } | undefined)?.macPolicy
      : (userPolicy.AppPolicy as { windowsPolicy?: unknown } | undefined)?.windowsPolicy
  ) as unknown

  return {
    osVersions: {
      win: {
        ok: String(systemPolicy.ApprovedVersionforWindows10 ?? ''),
        nudge: String(systemPolicy.NudgedVersionforWindows10 ?? '')
      },
      winNon10: {
        ok: String(systemPolicy['ApprovedVersionforWindowsNon-10.'] ?? ''),
        nudge: String(systemPolicy['NudgedVersionforWindowsnon-10.'] ?? '')
      },
      mac: {
        ok: String(systemPolicy.ApprovedVersionforMAC ?? ''),
        nudge: String(systemPolicy.NudgedVersionforMAC ?? '')
      }
    },
    screenIdle: {
      win: convertToIntOrNull(systemPolicy.ScreenIdleWindows, 1),
      mac: convertToIntOrNull(systemPolicy.ScreenIdleMac, 1)
    },
    screenLock: {
      win: convertToIntOrNull(systemPolicy.ScreenLockWindows, 0),
      mac: convertToIntOrNull(systemPolicy.ScreenLockMac, 0)
    },
    remoteLogin: {
      win: toPolicyStatus(String(systemPolicy.RemoteLoginWindowsNudge ?? PASS)),
      mac: toPolicyStatus(String(systemPolicy.RemoteLoginMacNudge ?? PASS))
    },
    firewall: toPolicyStatus(String(systemPolicy.Firewall ?? PASS)),
    diskEncryption: toPolicyStatus(String(systemPolicy.DiskEncryption ?? PASS)),
    winDefenderAV: toPolicyStatus(String(systemPolicy.WinDefenderAV ?? PASS)),
    activeWifiNetwork: toPolicyStatus(String(systemPolicy.ActiveWifiNetwork ?? PASS)),
    knownWifiNetworks: toPolicyStatus(String(systemPolicy.KnownWifiNetworks ?? PASS)),
    automaticUpdates: toPolicyStatus(String(systemPolicy.AutomaticUpdates ?? PASS)),
    scan: String(systemPolicy.ScanPage ?? '').toUpperCase() === 'YES',
    isShowPiiScan: String(systemPolicy.IsShowPIIScan ?? '').toUpperCase() === 'YES',
    scanIntervalHours: Number(systemPolicy.ScanIntervalHours ?? 24) || 24,
    networkSecurity: {
      wpa: toPolicyStatus(String(systemPolicy['NW-WPA'] ?? PASS)),
      wpa2: toPolicyStatus(String(systemPolicy['NW-WPA-2'] ?? PASS)),
      wpa3: toPolicyStatus(String(systemPolicy['NW-WPA-3'] ?? PASS))
    },
    networkId: toPolicyStatus(String(systemPolicy.NetworkIDPolicy ?? PASS)),
    networkIdIps: String(systemPolicy.NetworkIDIPs ?? ''),
    appsPolicy: {
      prohibitedApps: getProhibitedApps(appPolicy),
      requiredAppsCategories: getRequiredAppsCategories(appPolicy)
    }
  }
}
