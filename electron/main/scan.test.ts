import { describe, expect, it } from 'vitest'
import type { DeviceSnapshot, NormalizedPolicy } from '@shared/models'
import { FAIL, NUDGE, PASS } from '@shared/status'
import { evaluateDevice } from './scan'

function createPolicy(
  overrides: Partial<NormalizedPolicy> = {}
): NormalizedPolicy {
  return {
    osVersions: {
      win: { ok: '1.0.0', nudge: '1.0.0' },
      winNon10: { ok: '1.0.0', nudge: '1.0.0' },
      mac: { ok: '1.0.0', nudge: '1.0.0' }
    },
    screenIdle: { win: null, mac: null },
    screenLock: { win: null, mac: null },
    remoteLogin: { win: PASS, mac: PASS },
    firewall: PASS,
    diskEncryption: PASS,
    winDefenderAV: PASS,
    activeWifiNetwork: PASS,
    knownWifiNetworks: PASS,
    automaticUpdates: PASS,
    scan: true,
    isShowPiiScan: false,
    scanIntervalHours: 24,
    networkSecurity: {
      wpa: PASS,
      wpa2: PASS,
      wpa3: PASS
    },
    networkId: PASS,
    networkIdIps: '',
    appsPolicy: {
      prohibitedApps: [],
      requiredAppsCategories: []
    },
    ...overrides
  }
}

function createDevice(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    deviceName: 'test-device',
    platformName: 'Apple',
    platform: 'darwin',
    osVersion: '15.2.0',
    hardwareModel: 'arm64',
    hardwareSerial: 'serial',
    deviceId: 'device-id',
    firewallEnabled: true,
    diskEncryptionEnabled: true,
    automaticUpdatesEnabled: true,
    remoteLoginEnabled: false,
    winDefenderEnabled: null,
    activeWifiSecure: true,
    knownWifiSecure: true,
    networkIdInUse: '',
    installedApps: [],
    wifiConnections: [],
    screenIdleSeconds: null,
    screenLockSeconds: null,
    ...overrides
  }
}

describe('evaluateDevice firewall result', () => {
  it('uses macOS nudge wording when firewall is disabled and policy nudges', () => {
    const result = evaluateDevice(
      createDevice({ firewallEnabled: false }),
      createPolicy({ firewall: NUDGE })
    )

    const firewall = result.elements.find((item) => item.key === 'firewall')

    expect(result.firewall).toBe(NUDGE)
    expect(firewall).toMatchObject({
      status: NUDGE,
      description:
        'Firewalls control network traffic into and out of a system. Enabling the firewall on your device can prevent network-based attacks on your system and is especially important if you make use of unsecured wireless networks (such as at coffee shops and airports).',
      descriptionSteps: [
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
      ],
      detail:
        'The macOS firewall is turned off. Enabling it helps protect this device from unwanted network connections, especially on public or unsecured Wi-Fi networks.',
      fixInstruction:
        'Open System Settings > Network > Firewall and turn Firewall on.'
    })
  })

  it('uses macOS pass wording when firewall is enabled', () => {
    const result = evaluateDevice(
      createDevice({ firewallEnabled: true }),
      createPolicy({ firewall: FAIL })
    )

    const firewall = result.elements.find((item) => item.key === 'firewall')

    expect(result.firewall).toBe(PASS)
    expect(firewall).toMatchObject({
      status: PASS,
      detail: 'The macOS firewall is turned on.',
      fixInstruction: 'No action required.'
    })
  })

  it('uses Windows fail wording when any firewall profile is disabled', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        firewallEnabled: false,
        winDefenderEnabled: true
      }),
      createPolicy({ firewall: FAIL })
    )

    const firewall = result.elements.find((item) => item.key === 'firewall')

    expect(result.firewall).toBe(FAIL)
    expect(firewall).toMatchObject({
      status: FAIL,
      detail:
        "One or more Windows Defender Firewall profiles appear to be turned off. This device does not meet your organisation's firewall policy.",
      descriptionSteps: [
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
      ],
      fixInstruction:
        'Open Windows Security > Firewall & network protection and turn firewall on for the required profiles.'
    })
  })

  it('does not penalize the user when firewall state cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({ firewallEnabled: null }),
      createPolicy({ firewall: FAIL })
    )

    const firewall = result.elements.find((item) => item.key === 'firewall')

    expect(result.firewall).toBe(PASS)
    expect(firewall).toMatchObject({
      status: PASS,
      detail: 'Firewall status could not be determined.',
      fixInstruction:
        'Ensure the macOS firewall is turned on. Open System Settings > Network > Firewall and turn Firewall on if needed.'
    })
  })
})
