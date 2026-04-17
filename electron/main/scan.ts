import { hostname, machine, platform, release } from 'node:os'
import type {
  DeviceSnapshot,
  NormalizedPolicy,
  ScanElementDescriptionStep,
  ScanElementResult,
  ScanResultData,
  ScreenIdleState,
  WifiConnection
} from '@shared/models'
import { FAIL, NUDGE, PASS, type PolicyStatus } from '@shared/status'
import { config } from '../../src/config'
import {
  isDiskEncryptionOk,
  readDiskEncryptionState
} from './scan-checks/disk-encryption'
import { readAutomaticUpdates } from './scan-checks/automatic-updates'
import { readFirewallEnabled } from './scan-checks/firewall'
import { readRemoteLoginEnabled } from './scan-checks/remote-login'
import { readScreenIdle } from './scan-checks/screen-security'

const FIREWALL_DESCRIPTION =
  'Firewalls control network traffic into and out of a system. Enabling the firewall on your device can prevent network-based attacks on your system and is especially important if you make use of unsecured wireless networks (such as at coffee shops and airports).'
const DISK_ENCRYPTION_DESCRIPTION =
  "Full-disk encryption protects data at rest from being accessed by a party who does not know the password or decryption key. Systems containing internal data should be encrypted. It is every employee's responsibility to keep internal data safe."
const AUTOMATIC_UPDATES_DESCRIPTION =
  'One of the most important things you can do to secure your device(s) is to keep your operating system and software up to date. New vulnerabilities and weaknesses are found every day so frequent updates are essential to ensuring your device(s) include the latest fixes and preventative measures. Enabling automatic updating helps ensure your machine is up-to-date without having to manually install updates.'
const REMOTE_LOGIN_DESCRIPTION =
  "The 'Remote Login' setting on your device controls whether users can login remotely to the system."
const SCREEN_IDLE_DESCRIPTION =
  'Screens which lock automatically when your laptop is unattended help prevent unauthorized access. Your timeout setting should be equal to or less than company policy.'
const SCREEN_IDLE_RATIONALE =
  'Shorter idle times reduce the chance of someone accessing your Mac while it is unattended.'

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
  const automaticUpdates = await readAutomaticUpdates(currentPlatform)
  const remoteLoginEnabled = await readRemoteLoginEnabled(currentPlatform)
  const screenIdleState = await readScreenIdle(currentPlatform)

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
    // Remaining provisional bottom-layer values are acceptable in v1 scaffolding.
    automaticUpdates,
    automaticUpdatesEnabled: automaticUpdates.enabled,
    remoteLoginEnabled,
    winDefenderEnabled: currentPlatform === 'win32' ? true : null,
    activeWifiSecure: true,
    knownWifiSecure: true,
    networkIdInUse: publicIp,
    installedApps:
      currentPlatform === 'darwin' ? ['Safari'] : ['Microsoft Defender'],
    wifiConnections,
    screenIdleState,
    screenIdleSeconds:
      screenIdleState.kind === 'seconds' ? screenIdleState.seconds : null,
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

function evaluateScreenIdle(
  idleState: ScreenIdleState,
  maxAllowed: number | null
): PolicyStatus {
  if (maxAllowed == null || idleState.kind === 'unknown') {
    return PASS
  }

  if (idleState.kind === 'never') {
    return FAIL
  }

  return idleState.seconds <= maxAllowed ? PASS : FAIL
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
    device.remoteLoginEnabled == null
      ? null
      : device.remoteLoginEnabled === false
  )
  const winDefenderAV =
    device.platform === 'win32'
      ? evaluateBoolean(policy.winDefenderAV, device.winDefenderEnabled)
      : PASS
  const screenIdle = evaluateScreenIdle(
    device.screenIdleState,
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
      recommendFirewallAction(
        device.platform,
        device.firewallEnabled,
        firewall
      ),
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
      describeScreenIdleState(
        device.platform,
        device.screenIdleState,
        isMac ? policy.screenIdle.mac : policy.screenIdle.win
      ),
      recommendScreenIdleAction(
        device.platform,
        device.screenIdleState,
        isMac ? policy.screenIdle.mac : policy.screenIdle.win
      ),
      SCREEN_IDLE_DESCRIPTION,
      getScreenIdleDescriptionSteps(
        device.platform,
        isMac ? policy.screenIdle.mac : policy.screenIdle.win
      )
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
      describeAutomaticUpdatesState(device),
      recommendAutomaticUpdatesAction(device.platform, automaticUpdates),
      AUTOMATIC_UPDATES_DESCRIPTION,
      getAutomaticUpdatesDescriptionSteps(
        device.platform,
        automaticUpdates,
        device.automaticUpdates
      )
    ),
    buildElement(
      'remoteLogin',
      'Remote Login',
      remoteLogin,
      describeRemoteLoginState(device),
      recommendRemoteLoginAction(device.platform, device.remoteLoginEnabled),
      REMOTE_LOGIN_DESCRIPTION,
      getRemoteLoginDescriptionSteps(device.platform)
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
        linkUrl:
          'x-apple.systempreferences:com.apple.Network-Settings.extension',
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

  return [
    { text: 'Open device settings and ensure the system firewall is on.' }
  ]
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

function getAutomaticUpdatesDescriptionSteps(
  currentPlatform: string,
  status: PolicyStatus,
  automaticUpdates: DeviceSnapshot['automaticUpdates']
): ScanElementDescriptionStep[] {
  if (currentPlatform === 'darwin') {
    if (automaticUpdates.mojaveOrLater === false) {
      return [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'App Store',
          linkUrl: 'prefs://com.apple.preferences.appstore',
          suffix: '.'
        },
        { text: 'Ensure automatic updates are On.' }
      ]
    }

    const steps: ScanElementDescriptionStep[] = [
      { text: 'Choose System Settings from the Apple menu.' },
      {
        text: 'Click ',
        linkText: 'Software Update',
        linkUrl:
          'x-apple.systempreferences:com.apple.preferences.softwareupdate',
        suffix: '.'
      }
    ]

    const checks = automaticUpdates.checks.filter(
      (check) =>
        automaticUpdates.tahoeOrLater !== true ||
        check.key !== 'automaticAppUpdates'
    )

    steps.push({
      text: 'Click on the info icon in front of Automatic Updates and make sure the following are checked:',
      children: checks.map((check) => ({
        text: check.label,
        status: automaticUpdateCheckStatus(check.enabled)
      }))
    })

    if (automaticUpdates.tahoeOrLater === true) {
      const appUpdates = automaticUpdates.checks.find(
        (check) => check.key === 'automaticAppUpdates'
      )

      steps.push(
        {
          text: 'Open ',
          linkText: 'App Store',
          action: 'openAppStore',
          suffix: '.'
        },
        {
          text: 'Click on the App Store menu at the top and then click Settings.'
        },
        {
          text: 'In the dialog, check the Automatic Updates checkbox.',
          status: appUpdates
            ? automaticUpdateCheckStatus(appUpdates.enabled)
            : undefined
        }
      )
    }

    return steps
  }

  if (currentPlatform === 'win32') {
    if (status === PASS) {
      return [
        {
          text: 'Open ',
          linkText: 'Windows Update',
          linkUrl: 'ms-settings:windowsupdate',
          suffix: ' settings.'
        },
        {
          text: 'You must not pause the updates in the Windows Update settings.'
        },
        {
          text: 'If you ever happen to pause the updates, you would see a "Resume updates" button at top of the settings. Click on the button to enable automatic updates.'
        }
      ]
    }

    return [
      {
        text: 'Open ',
        linkText: 'Windows Update',
        linkUrl: 'ms-settings:windowsupdate',
        suffix: ' settings.'
      },
      {
        text: 'Click on the "Resume updates" button to enable automatic updates.'
      }
    ]
  }

  return [
    {
      text: 'Open device update settings and ensure automatic updates are enabled.'
    }
  ]
}

function getRemoteLoginDescriptionSteps(
  currentPlatform: string
): ScanElementDescriptionStep[] {
  if (currentPlatform === 'darwin') {
    return [
      { text: 'Choose System Settings from the Apple menu.' },
      {
        text: 'Click ',
        linkText: 'Sharing',
        linkUrl:
          'x-apple.systempreferences:com.apple.preferences.sharing?Services_RemoteLogin',
        suffix: '.'
      },
      { text: 'Uncheck "Remote Login".' }
    ]
  }

  if (currentPlatform === 'win32') {
    return [
      {
        text: 'Open ',
        linkText: 'System Properties',
        action: 'openRemoteLoginSettings',
        suffix: ' and select the Remote tab.',
        note: 'Note: If the link does not open System Properties, press Windows + R, enter SystemPropertiesRemote.exe, and press Enter.'
      },
      {
        text: 'Under the "Remote Desktop" section, select "Don\'t allow remote connections to this computer".'
      },
      { text: 'Click Apply.' },
      { text: 'Click OK.' }
    ]
  }

  return [
    {
      text: 'Open device sharing settings and disable remote login.'
    }
  ]
}

function getScreenIdleDescriptionSteps(
  currentPlatform: string,
  policySeconds: number | null
): ScanElementDescriptionStep[] {
  const policyLabel =
    policySeconds == null
      ? 'N/A'
      : formatScreenIdleDuration(currentPlatform, policySeconds)

  if (currentPlatform === 'darwin') {
    return [
      { text: 'Choose System Settings from the Apple menu.' },
      {
        text: 'Open ',
        linkText: 'Lock Screen',
        linkUrl: 'x-apple.systempreferences:com.apple.Lock',
        suffix: ' on the left.'
      },
      {
        text:
          policySeconds == null
            ? 'For the "Start Screen Saver when inactive" dropdown, select a shorter time.'
            : `Adjust the "Start Screen Saver when inactive" dropdown to less than or equal to the company policy (${policyLabel}).`,
        children:
          policySeconds == null ? [{ text: SCREEN_IDLE_RATIONALE }] : undefined
      }
    ]
  }

  if (currentPlatform === 'win32') {
    return [
      { text: 'Open Screen Saver Settings.' },
      {
        text:
          policySeconds == null
            ? 'Set the wait time; the lower the value, the safer it is.'
            : `Set the wait time to less than or equal to the company policy (${policyLabel}).`
      }
    ]
  }

  return [
    {
      text: 'Open device settings and reduce the screen idle timeout.'
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

function describeAutomaticUpdatesState(device: DeviceSnapshot): string {
  if (device.automaticUpdatesEnabled == null) {
    return 'Automatic update settings could not be fully verified.'
  }

  if (device.platform === 'win32') {
    return device.automaticUpdatesEnabled
      ? 'Windows updates do not appear to be paused.'
      : 'Windows updates appear to be paused.'
  }

  return device.automaticUpdatesEnabled
    ? 'Automatic updates appear enabled.'
    : 'One or more automatic update settings appear disabled.'
}

function describeRemoteLoginState(device: DeviceSnapshot): string {
  if (device.remoteLoginEnabled == null) {
    return 'Remote login status could not be determined.'
  }

  return device.remoteLoginEnabled
    ? 'Remote login appears enabled.'
    : 'Remote login appears disabled.'
}

function describeScreenIdleState(
  currentPlatform: string,
  idleState: ScreenIdleState,
  policySeconds: number | null
): string {
  if (policySeconds == null) {
    return `Company policy: N/A. Your setting: ${formatScreenIdleState(currentPlatform, idleState)}.`
  }

  if (idleState.kind === 'unknown') {
    return 'Screen idle setting could not be determined.'
  }

  const policyLabel = formatScreenIdleDuration(currentPlatform, policySeconds)

  if (idleState.kind === 'never') {
    return `Company policy: ${policyLabel}. Your setting: Never.`
  }

  return `Company policy: ${policyLabel}. Your setting: ${formatScreenIdleDuration(
    currentPlatform,
    idleState.seconds
  )}.`
}

function formatScreenIdleState(
  currentPlatform: string,
  idleState: ScreenIdleState
): string {
  if (idleState.kind === 'seconds') {
    return formatScreenIdleDuration(currentPlatform, idleState.seconds)
  }

  if (idleState.kind === 'never') {
    return 'Never'
  }

  return 'Unknown'
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

function recommendAutomaticUpdatesAction(
  currentPlatform: string,
  status: PolicyStatus
): string {
  if (status === PASS) {
    return 'No action required.'
  }

  if (currentPlatform === 'win32') {
    return 'Open Windows Update settings and click Resume updates.'
  }

  if (currentPlatform === 'darwin') {
    return 'Open Software Update settings and turn on automatic updates.'
  }

  return 'Turn on automatic operating system updates.'
}

function recommendRemoteLoginAction(
  currentPlatform: string,
  enabled: boolean | null
): string {
  if (enabled === false) {
    return 'No action required.'
  }

  if (enabled == null) {
    return 'Disable remote login unless explicitly required.'
  }

  if (currentPlatform === 'darwin') {
    return 'Open System Settings > Sharing and turn Remote Login off.'
  }

  if (currentPlatform === 'win32') {
    return 'Open Advanced System Preferences and disable Remote Desktop connections.'
  }

  return 'Disable remote login unless explicitly required.'
}

function recommendScreenIdleAction(
  currentPlatform: string,
  idleState: ScreenIdleState,
  policySeconds: number | null
): string {
  if (
    policySeconds == null ||
    idleState.kind === 'unknown' ||
    (idleState.kind === 'seconds' && idleState.seconds <= policySeconds)
  ) {
    return 'No action required.'
  }

  if (currentPlatform === 'darwin') {
    return 'Open System Settings > Lock Screen and reduce the screen saver idle timeout.'
  }

  if (currentPlatform === 'win32') {
    return 'Open Screen Saver Settings and reduce the wait time.'
  }

  return 'Reduce the screen idle timeout in device settings.'
}

function automaticUpdateCheckStatus(enabled: boolean | null): PolicyStatus {
  if (enabled === false) {
    return FAIL
  }

  return PASS
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

function formatScreenIdleDuration(
  currentPlatform: string,
  seconds: number
): string {
  if (currentPlatform === 'win32') {
    return formatMinutesSeconds(seconds)
  }

  return formatHoursMinutesSeconds(seconds)
}

function formatHoursMinutesSeconds(totalSeconds: number): string {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 0) {
    return 'N/A'
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  }

  return parts.join(' ')
}

function formatMinutesSeconds(totalSeconds: number): string {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 0) {
    return 'N/A'
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  }

  return parts.join(' ')
}
