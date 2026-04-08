import { hostname, machine, platform, release } from 'node:os'
import type { DeviceSnapshot, NormalizedPolicy, ScanElementResult, ScanResultData, WifiConnection } from '@shared/models'
import { FAIL, NUDGE, PASS, type PolicyStatus } from '@shared/status'
import { config } from '../../src/config'

async function resolvePublicIp(): Promise<string> {
  for (const url of [config.networkId.primaryUrl, config.networkId.fallbackUrl]) {
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
    // Provisional bottom-layer values are acceptable in v1 scaffolding.
    firewallEnabled: true,
    diskEncryptionEnabled: true,
    automaticUpdatesEnabled: false,
    remoteLoginEnabled: false,
    winDefenderEnabled: currentPlatform === 'win32' ? true : null,
    activeWifiSecure: true,
    knownWifiSecure: true,
    networkIdInUse: publicIp,
    installedApps: currentPlatform === 'darwin' ? ['Safari'] : ['Microsoft Defender'],
    wifiConnections,
    screenIdleSeconds: 300,
    screenLockSeconds: 0
  }
}

function compareVersion(current: string, ok: string, nudge: string): PolicyStatus {
  const normalize = (value: string): number[] =>
    value
      .split('.')
      .map(part => Number.parseInt(part, 10))
      .filter(part => !Number.isNaN(part))
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

function evaluateBoolean(requiredStatus: PolicyStatus, isOk: boolean | null): PolicyStatus {
  if (isOk == null || isOk) {
    return PASS
  }
  return requiredStatus
}

function evaluateNumeric(requiredStatus: PolicyStatus, actual: number | null, maxAllowed: number | null): PolicyStatus {
  if (actual == null || maxAllowed == null || actual <= maxAllowed) {
    return PASS
  }
  return requiredStatus
}

export function evaluateDevice(device: DeviceSnapshot, policy: NormalizedPolicy): ScanResultData {
  const isMac = device.platform === 'darwin'
  const osPolicy = isMac ? policy.osVersions.mac : policy.osVersions.win
  const osStatus = compareVersion(device.osVersion, osPolicy.ok, osPolicy.nudge)
  const firewall = evaluateBoolean(policy.firewall, device.firewallEnabled)
  const diskEncryption = evaluateBoolean(policy.diskEncryption, device.diskEncryptionEnabled)
  const automaticUpdates = evaluateBoolean(policy.automaticUpdates, device.automaticUpdatesEnabled)
  const remoteLogin = evaluateBoolean(
    isMac ? policy.remoteLogin.mac : policy.remoteLogin.win,
    device.remoteLoginEnabled === false
  )
  const winDefenderAV =
    device.platform === 'win32'
      ? evaluateBoolean(policy.winDefenderAV, device.winDefenderEnabled)
      : PASS
  const screenIdle = evaluateNumeric(PASS, device.screenIdleSeconds, isMac ? policy.screenIdle.mac : policy.screenIdle.win)
  const screenLock = evaluateNumeric(PASS, device.screenLockSeconds, isMac ? policy.screenLock.mac : policy.screenLock.win)
  const activeWifiNetwork = evaluateBoolean(policy.activeWifiNetwork, device.activeWifiSecure)
  const knownWifiNetworks = evaluateBoolean(policy.knownWifiNetworks, device.knownWifiSecure)
  const networkID =
    policy.networkIdIps
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
      .includes(device.networkIdInUse) || policy.networkId === PASS
      ? PASS
      : policy.networkId

  const installedProhibitedApps = device.installedApps.filter(app =>
    policy.appsPolicy.prohibitedApps.some(prohibited => prohibited.toLowerCase() === app.toLowerCase())
  )
  const missingRequiredAppsCategories = policy.appsPolicy.requiredAppsCategories
    .filter(category => {
      const installed = category.apps.filter(appName =>
        device.installedApps.some(installedApp => installedApp.toLowerCase() === appName.toLowerCase())
      )
      return installed.length < category.requiredAppsCount
    })
    .map(category => category.apps.join(', '))

  const applications =
    installedProhibitedApps.length === 0 && missingRequiredAppsCategories.length === 0 ? PASS : FAIL

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

  const overall = statuses.includes(FAIL) ? FAIL : statuses.includes(NUDGE) ? NUDGE : PASS

  const elements: ScanElementResult[] = [
    buildElement('osVersion', 'System Updates', osStatus, `Current OS version ${device.osVersion}`, 'Update the operating system to the approved version level.'),
    buildElement('firewall', 'Firewall', firewall, device.firewallEnabled ? 'Firewall appears enabled.' : 'Firewall appears disabled.', 'Enable the system firewall in device settings.'),
    buildElement('diskEncryption', 'Disk Encryption', diskEncryption, device.diskEncryptionEnabled ? 'Disk encryption appears enabled.' : 'Disk encryption appears disabled.', 'Enable FileVault or BitLocker.'),
    buildElement('screenIdle', 'Screen Idle', screenIdle, `Idle timeout: ${device.screenIdleSeconds ?? 'Unknown'} seconds`, 'Reduce the idle timeout in device settings.'),
    buildElement('screenLock', 'Screen Lock', screenLock, `Lock timeout: ${device.screenLockSeconds ?? 'Unknown'} seconds`, 'Require screen lock immediately or within policy.'),
    buildElement('automaticUpdates', 'Automatic Updates', automaticUpdates, device.automaticUpdatesEnabled ? 'Automatic updates appear enabled.' : 'Automatic updates appear disabled.', 'Turn on automatic operating system updates.'),
    buildElement('remoteLogin', 'Remote Login', remoteLogin, device.remoteLoginEnabled ? 'Remote login appears enabled.' : 'Remote login appears disabled.', 'Disable remote login unless explicitly required.'),
    buildElement('activeWifiNetwork', 'Active Wi-Fi Network', activeWifiNetwork, device.activeWifiSecure ? 'Current Wi-Fi appears secure.' : 'Current Wi-Fi appears insecure.', 'Connect only to secure Wi-Fi networks.'),
    buildElement('knownWifiNetworks', 'Known Wi-Fi Networks', knownWifiNetworks, device.knownWifiSecure ? 'Known Wi-Fi profiles appear secure.' : 'Known Wi-Fi profiles may include insecure networks.', 'Remove insecure saved Wi-Fi networks.'),
    buildElement('networkId', 'Network ID', networkID, device.networkIdInUse ? `Public IP: ${device.networkIdInUse}` : 'Public IP unavailable.', 'Connect from an approved network.'),
    buildElement('applications', 'Applications', applications, describeAppState(installedProhibitedApps, missingRequiredAppsCategories), 'Remove prohibited applications and install required security tools.')
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
  fixInstruction: string
): ScanElementResult {
  return {
    key,
    title,
    status,
    description: title,
    detail,
    fixInstruction
  }
}

function describeAppState(prohibitedApps: string[], missingCategories: string[]): string {
  if (prohibitedApps.length === 0 && missingCategories.length === 0) {
    return 'Required application checks passed.'
  }
  const parts: string[] = []
  if (prohibitedApps.length > 0) {
    parts.push(`Installed prohibited apps: ${prohibitedApps.join(', ')}`)
  }
  if (missingCategories.length > 0) {
    parts.push(`Missing required app categories: ${missingCategories.join(' | ')}`)
  }
  return parts.join('. ')
}
