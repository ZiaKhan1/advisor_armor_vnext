import { hostname, machine, platform, release } from 'node:os'
import type {
  DeviceSnapshot,
  NormalizedPolicy,
  ScanElementDescriptionStep,
  ScanElementResult,
  ScanResultData,
  WifiConnection
} from '@shared/models'
import { FAIL, NUDGE, PASS, type PolicyStatus } from '@shared/status'
import { config } from '../../src/config'
import {
  isDiskEncryptionOk,
  readDiskEncryptionState
} from './scan-checks/disk-encryption'
import { readFirewallEnabled } from './scan-checks/firewall'

const FIREWALL_DESCRIPTION =
  'Firewalls control network traffic into and out of a system. Enabling the firewall on your device can prevent network-based attacks on your system and is especially important if you make use of unsecured wireless networks (such as at coffee shops and airports).'
const DISK_ENCRYPTION_DESCRIPTION =
  "Full-disk encryption protects data at rest from being accessed by a party who does not know the password or decryption key. Systems containing internal data should be encrypted. It is every employee's responsibility to keep internal data safe."

async function resolvePublicIp(): Promise<string> {
  for (const url of [
    config.networkId.primaryUrl,
    config.networkId.fallbackUrl
  ]) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return (await response.text()).trim()
      }
    } catch {
      continue
    }
  }
  return ''
}

export async function readDeviceSnapshot(): Promise<DeviceSnapshot> {
  const currentPlatform = platform()
  const publicIp = await resolvePublicIp()
  const firewallEnabled = await readFirewallEnabled(currentPlatform)
  const diskEncryptionState = await readDiskEncryptionState(currentPlatform)
  const diskEncryptionEnabled = isDiskEncryptionOk(diskEncryptionState)

  const wifiConnections: WifiConnection[] = [
    {
      id: 'wifi-1',
      iface: currentPlatform === 'win32' ? 'Wi-Fi' : 'en0',
      model: 'Built-in',
      ssid: 'OfficeNet',
      bssid: '00:00:00:00:00:00',
      channel: '36',
      frequency: '5 GHz',
      type: 'wifi',
      security: 'WPA2',
      signalLevel: '-40 dBm',
      txRate: '866 Mbps',
      wpaResult: FAIL,
      wpa2Result: PASS,
      wpa3Result: FAIL
    }
  ]

  return {
    deviceName: hostname(),
    platformName: currentPlatform === 'darwin' ? 'Apple' : 'Microsoft',
    platform: currentPlatform,
    osVersion: release(),
    hardwareModel: machine(),
    hardwareSerial: 'PROVISIONAL-SERIAL',
    deviceId: 'PROVISIONAL-DEVICE-ID',
    firewallEnabled,
    diskEncryptionEnabled,
    diskEncryptionState,
    // Provisional bottom-layer values are acceptable in v1 scaffolding.
    automaticUpdatesEnabled: false,
    remoteLoginEnabled: false,
    winDefenderEnabled: currentPlatform === 'win32' ? true : null,
    activeWifiSecure: true,
    knownWifiSecure: true,
    networkIdInUse: publicIp,
    installedApps:
      currentPlatform === 'darwin' ? ['Safari'] : ['Microsoft Defender'],
    wifiConnections,
    screenIdleSeconds: 300,
    screenLockSeconds: 0
  }
}

function compareVersion(
  current: string,
  ok: string,
  nudge: string
): PolicyStatus {
  const normalize = (value: string): number[] =>
    value
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => !Number.isNaN(part))
  const compare = (left: number[], right: number[]): number => {
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
      const leftValue = left[index] ?? 0
      const rightValue = right[index] ?? 0
      if (leftValue > rightValue) {
        return 1
      }
      if (leftValue < rightValue) {
        return -1
      }
    }
    return 0
  }

  const currentParts = normalize(current)
  if (ok && compare(currentParts, normalize(ok)) >= 0) {
    return PASS
  }
  if (nudge && compare(currentParts, normalize(nudge)) >= 0) {
    return NUDGE
  }
  return FAIL
}

function evaluateBoolean(
  requiredStatus: PolicyStatus,
  isOk: boolean | null
): PolicyStatus {
  if (isOk == null || isOk) {
    return PASS
  }
  return requiredStatus
}

function evaluateNumeric(
  requiredStatus: PolicyStatus,
  actual: number | null,
  maxAllowed: number | null
): PolicyStatus {
  if (actual == null || maxAllowed == null || actual <= maxAllowed) {
    return PASS
  }
  return requiredStatus
}

export function evaluateDevice(
  device: DeviceSnapshot,
  policy: NormalizedPolicy
): ScanResultData {
  const isMac = device.platform === 'darwin'
  const osPolicy = isMac ? policy.osVersions.mac : policy.osVersions.win
  const osStatus = compareVersion(device.osVersion, osPolicy.ok, osPolicy.nudge)
  const firewall = evaluateBoolean(policy.firewall, device.firewallEnabled)
  const diskEncryption = evaluateBoolean(
    policy.diskEncryption,
    isDiskEncryptionOk(device.diskEncryptionState)
  )
  const automaticUpdates = evaluateBoolean(
    policy.automaticUpdates,
    device.automaticUpdatesEnabled
  )
  const remoteLogin = evaluateBoolean(
    isMac ? policy.remoteLogin.mac : policy.remoteLogin.win,
    device.remoteLoginEnabled === false
  )
  const winDefenderAV =
    device.platform === 'win32'
      ? evaluateBoolean(policy.winDefenderAV, device.winDefenderEnabled)
      : PASS
  const screenIdle = evaluateNumeric(
    PASS,
    device.screenIdleSeconds,
    isMac ? policy.screenIdle.mac : policy.screenIdle.win
  )
  const screenLock = evaluateNumeric(
    PASS,
    device.screenLockSeconds,
    isMac ? policy.screenLock.mac : policy.screenLock.win
  )
  const activeWifiNetwork = evaluateBoolean(
    policy.activeWifiNetwork,
    device.activeWifiSecure
  )
  const knownWifiNetworks = evaluateBoolean(
    policy.knownWifiNetworks,
    device.knownWifiSecure
  )
  const networkID =
    policy.networkIdIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
      .includes(device.networkIdInUse) || policy.networkId === PASS
      ? PASS
      : policy.networkId

  const installedProhibitedApps = device.installedApps.filter((app) =>
    policy.appsPolicy.prohibitedApps.some(
      (prohibited) => prohibited.toLowerCase() === app.toLowerCase()
    )
  )
  const missingRequiredAppsCategories = policy.appsPolicy.requiredAppsCategories
    .filter((category) => {
      const installed = category.apps.filter((appName) =>
        device.installedApps.some(
          (installedApp) => installedApp.toLowerCase() === appName.toLowerCase()
        )
      )
      return installed.length < category.requiredAppsCount
    })
    .map((category) => category.apps.join(', '))

  const applications =
    installedProhibitedApps.length === 0 &&
    missingRequiredAppsCategories.length === 0
      ? PASS
      : FAIL

  const statuses: PolicyStatus[] = [
    osStatus,
    firewall,
    diskEncryption,
    screenIdle,
    screenLock,
    automaticUpdates,
    remoteLogin,
    activeWifiNetwork,
    knownWifiNetworks,
    networkID,
    applications,
    winDefenderAV
  ]

  const overall = statuses.includes(FAIL)
    ? FAIL
    : statuses.includes(NUDGE)
      ? NUDGE
      : PASS

  const elements: ScanElementResult[] = [
    buildElement(
      'osVersion',
      'System Updates',
      osStatus,
      `Current OS version ${device.osVersion}`,
      'Update the operating system to the approved version level.'
    ),
    buildElement(
      'firewall',
      'Firewall',
      firewall,
      describeFirewallState(device.platform, device.firewallEnabled, firewall),
      recommendFirewallAction(device.platform, device.firewallEnabled, firewall),
      FIREWALL_DESCRIPTION,
      getFirewallDescriptionSteps(device.platform)
    ),
    buildElement(
      'diskEncryption',
      'Disk Encryption',
      diskEncryption,
      describeDiskEncryptionState(device.platform, device.diskEncryptionState),
      recommendDiskEncryptionAction(
        device.platform,
        device.diskEncryptionState
      ),
      DISK_ENCRYPTION_DESCRIPTION,
      getDiskEncryptionDescriptionSteps(device.platform)
    ),
    buildElement(
      'screenIdle',
      'Screen Idle',
      screenIdle,
      `Idle timeout: ${device.screenIdleSeconds ?? 'Unknown'} seconds`,
      'Reduce the idle timeout in device settings.'
    ),
    buildElement(
      'screenLock',
      'Screen Lock',
      screenLock,
      `Lock timeout: ${device.screenLockSeconds ?? 'Unknown'} seconds`,
      'Require screen lock immediately or within policy.'
    ),
    buildElement(
      'automaticUpdates',
      'Automatic Updates',
      automaticUpdates,
      device.automaticUpdatesEnabled
        ? 'Automatic updates appear enabled.'
        : 'Automatic updates appear disabled.',
      'Turn on automatic operating system updates.'
    ),
    buildElement(
      'remoteLogin',
      'Remote Login',
      remoteLogin,
      device.remoteLoginEnabled
        ? 'Remote login appears enabled.'
        : 'Remote login appears disabled.',
      'Disable remote login unless explicitly required.'
    ),
    buildElement(
      'activeWifiNetwork',
      'Active Wi-Fi Network',
      activeWifiNetwork,
      device.activeWifiSecure
        ? 'Current Wi-Fi appears secure.'
        : 'Current Wi-Fi appears insecure.',
      'Connect only to secure Wi-Fi networks.'
    ),
    buildElement(
      'knownWifiNetworks',
      'Known Wi-Fi Networks',
      knownWifiNetworks,
      device.knownWifiSecure
        ? 'Known Wi-Fi profiles appear secure.'
        : 'Known Wi-Fi profiles may include insecure networks.',
      'Remove insecure saved Wi-Fi networks.'
    ),
    buildElement(
      'networkId',
      'Network ID',
      networkID,
      device.networkIdInUse
        ? `Public IP: ${device.networkIdInUse}`
        : 'Public IP unavailable.',
      'Connect from an approved network.'
    ),
    buildElement(
      'applications',
      'Applications',
      applications,
      describeAppState(installedProhibitedApps, missingRequiredAppsCategories),
      'Remove prohibited applications and install required security tools.'
    )
  ]

  return {
    status: overall,
    osVersion: osStatus,
    firewall,
    diskEncryption,
    winDefenderAV,
    screenLock,
    screenIdle,
    automaticUpdates,
    remoteLogin,
    activeWifiNetwork,
    knownWifiNetworks,
    networkID,
    networkIDInUse: device.networkIdInUse,
    applications,
    appsPolicyResult: {
      appsScanResult: applications,
      installedProhibitedApps,
      missingRequiredAppsCategories
    },
    elements
  }
}

function buildElement(
  key: ScanElementResult['key'],
  title: string,
  status: PolicyStatus,
  detail: string,
  fixInstruction: string,
  description = title,
  descriptionSteps?: ScanElementDescriptionStep[]
): ScanElementResult {
  return {
    key,
    title,
    status,
    description,
    descriptionSteps,
    detail,
    fixInstruction
  }
}

function getFirewallDescriptionSteps(
  currentPlatform: string
): ScanElementDescriptionStep[] {
  if (currentPlatform === 'darwin') {
    return [
      { text: 'Choose System Settings from the Apple menu.' },
      {
        text: 'Click ',
        linkText: 'Network',
        linkUrl: 'x-apple.systempreferences:com.apple.Network-Settings.extension',
        suffix: '.'
      },
      { text: 'Click Firewall.' },
      { text: 'Turn Firewall on.' },
      {
        text: 'If prompted, enter your Mac administrator password or use Touch ID.'
      }
    ]
  }

  if (currentPlatform === 'win32') {
    return [
      {
        text: 'Open ',
        linkText: 'Windows Defender Firewall',
        action: 'openFirewallSettings'
      },
      {
        text: 'Click Windows Defender Firewall Properties.'
      },
      {
        text: 'On the Domain Profile, Private Profile, and Public Profile tabs, set Firewall state to On (recommended).'
      },
      { text: 'Click OK.' }
    ]
  }

  return [{ text: 'Open device settings and ensure the system firewall is on.' }]
}

function getDiskEncryptionDescriptionSteps(
  currentPlatform: string
): ScanElementDescriptionStep[] {
  if (currentPlatform === 'darwin') {
    return [
      { text: 'Open System Settings from the Apple menu.' },
      {
        text: 'Click ',
        linkText: 'Privacy & Security',
        linkUrl: 'x-apple.systempreferences:com.apple.preference.security',
        suffix: '.'
      },
      { text: 'Scroll to FileVault.' },
      { text: 'Turn FileVault on.' },
      {
        text: 'If prompted, enter your Mac administrator password or use Touch ID.'
      },
      {
        text: 'Choose whether to allow your iCloud account to unlock your disk or create a recovery key. If you create a recovery key, store it in a safe place.'
      }
    ]
  }

  if (currentPlatform === 'win32') {
    return [
      {
        text: 'Open ',
        linkText: 'BitLocker Drive Encryption',
        action: 'openDiskEncryptionSettings'
      },
      { text: 'Find the operating system drive, usually C:.' },
      { text: 'Turn on BitLocker or resume protection if it is suspended.' },
      { text: 'Follow the prompts to save the recovery key.' },
      {
        text: 'Start encryption and keep the device connected to power until encryption completes.'
      }
    ]
  }

  return [
    {
      text: 'Open device settings and ensure full-disk encryption is turned on.'
    }
  ]
}

function describeAppState(
  prohibitedApps: string[],
  missingCategories: string[]
): string {
  if (prohibitedApps.length === 0 && missingCategories.length === 0) {
    return 'Required application checks passed.'
  }
  const parts: string[] = []
  if (prohibitedApps.length > 0) {
    parts.push(`Installed prohibited apps: ${prohibitedApps.join(', ')}`)
  }
  if (missingCategories.length > 0) {
    parts.push(
      `Missing required app categories: ${missingCategories.join(' | ')}`
    )
  }
  return parts.join('. ')
}

function describeFirewallState(
  currentPlatform: string,
  enabled: boolean | null,
  status: PolicyStatus
): string {
  if (enabled == null) {
    return 'Firewall status could not be determined.'
  }

  if (currentPlatform === 'darwin') {
    if (enabled) {
      return 'The macOS firewall is turned on.'
    }

    if (status === FAIL) {
      return "The macOS firewall is turned off. This device does not meet your organisation's firewall policy."
    }

    return 'The macOS firewall is turned off. Enabling it helps protect this device from unwanted network connections, especially on public or unsecured Wi-Fi networks.'
  }

  if (currentPlatform === 'win32') {
    if (enabled) {
      return 'Windows Defender Firewall is turned on for the required network profiles.'
    }

    if (status === FAIL) {
      return "One or more Windows Defender Firewall profiles appear to be turned off. This device does not meet your organisation's firewall policy."
    }

    return 'One or more Windows Defender Firewall profiles appear to be turned off. The firewall helps protect this device from unwanted network connections, especially on public or unsecured networks.'
  }

  return enabled ? 'Firewall appears enabled.' : 'Firewall appears disabled.'
}

function describeDiskEncryptionState(
  currentPlatform: string,
  state: DeviceSnapshot['diskEncryptionState']
): string {
  if (currentPlatform === 'darwin') {
    if (state === 'enabled') {
      return 'FileVault is turned on.'
    }
    if (state === 'encrypting') {
      return 'FileVault encryption is in progress.'
    }
    if (state === 'decrypting') {
      return 'FileVault decryption is in progress.'
    }
    if (state === 'disabled') {
      return 'FileVault is turned off.'
    }
    return 'Disk encryption status could not be determined.'
  }

  if (currentPlatform === 'win32') {
    if (state === 'enabled') {
      return 'BitLocker appears to be turned on for the Windows system drive.'
    }
    if (state === 'suspended') {
      return 'BitLocker appears to be suspended for the Windows system drive.'
    }
    if (state === 'disabled') {
      return 'BitLocker appears to be turned off for the Windows system drive.'
    }
    return 'Disk encryption status could not be determined.'
  }

  if (state === 'enabled' || state === 'encrypting') {
    return 'Disk encryption appears enabled.'
  }

  if (state === 'disabled' || state === 'decrypting' || state === 'suspended') {
    return 'Disk encryption appears disabled.'
  }

  return 'Disk encryption status could not be determined.'
}

function recommendDiskEncryptionAction(
  currentPlatform: string,
  state: DeviceSnapshot['diskEncryptionState']
): string {
  if (state === 'enabled') {
    return 'No action required.'
  }

  if (state === 'encrypting') {
    return 'No action required. Keep the device powered on until encryption completes.'
  }

  if (currentPlatform === 'darwin') {
    if (state === 'decrypting') {
      return 'Stop decryption and keep FileVault turned on.'
    }
    if (state === 'unknown') {
      return 'Ensure FileVault is turned on.'
    }
    return 'Turn on FileVault.'
  }

  if (currentPlatform === 'win32') {
    if (state === 'suspended') {
      return 'Resume BitLocker protection for the Windows system drive.'
    }
    if (state === 'unknown') {
      return 'Ensure BitLocker or Windows device encryption is turned on for the system drive.'
    }
    return 'Turn on BitLocker for the Windows system drive.'
  }

  if (state === 'unknown') {
    return 'Ensure full-disk encryption is turned on.'
  }

  return 'Turn on full-disk encryption.'
}

function recommendFirewallAction(
  currentPlatform: string,
  enabled: boolean | null,
  status: PolicyStatus
): string {
  if (enabled) {
    return 'No action required.'
  }

  if (currentPlatform === 'darwin') {
    if (enabled == null) {
      return 'Ensure the macOS firewall is turned on. Open System Settings > Network > Firewall and turn Firewall on if needed.'
    }

    return 'Open System Settings > Network > Firewall and turn Firewall on.'
  }

  if (currentPlatform === 'win32') {
    if (enabled == null) {
      return 'Ensure Windows Defender Firewall is turned on. Open Windows Security > Firewall & network protection and turn firewall on for the required profiles if needed.'
    }

    return 'Open Windows Security > Firewall & network protection and turn firewall on for the required profiles.'
  }

  if (enabled == null) {
    return 'Ensure the system firewall is enabled in device settings.'
  }

  if (status === PASS) {
    return 'No action required.'
  }

  return 'Enable the system firewall in device settings.'
}
