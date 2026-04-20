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
    diskEncryptionState: 'enabled',
    automaticUpdatesEnabled: true,
    automaticUpdates: {
      enabled: true,
      checks: [
        {
          key: 'automaticDownloadUpdates',
          label: 'Download new updates when available',
          enabled: true
        },
        {
          key: 'automaticOsUpdates',
          label: 'Install macOS updates',
          enabled: true
        },
        {
          key: 'automaticAppUpdates',
          label: 'Install application updates from the App Store',
          enabled: true
        },
        {
          key: 'automaticSecurityUpdates',
          label: 'Install Security Responses and system files',
          enabled: true
        }
      ],
      mojaveOrLater: true,
      tahoeOrLater: false
    },
    remoteLoginEnabled: false,
    winDefenderEnabled: null,
    activeWifiSecure: true,
    activeWifiAssessment: {
      status: 'secure',
      reason: 'modern-protocol',
      reasonText: 'uses a modern security mode',
      securityLabel: 'WPA2 Personal',
      detail:
        'Current Wi-Fi "OfficeNet" uses a modern security mode: WPA2 Personal.'
    },
    knownWifiSecure: true,
    knownWifiAssessment: {
      status: 'secure',
      detail: 'No insecure saved Wi-Fi networks were found on this device.',
      networkCount: 0,
      insecureNetworks: []
    },
    networkIdInUse: '',
    installedApps: [],
    wifiConnections: [],
    screenIdleState: { kind: 'unknown' },
    screenIdleSeconds: null,
    screenLockState: { kind: 'unknown' },
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
        'One or more Windows Defender Firewall profiles appear to be turned off.',
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

describe('evaluateDevice active Wi-Fi result', () => {
  it.each([
    {
      name: 'passes secure Wi-Fi regardless of fail policy',
      activeWifiSecure: true,
      policyValue: FAIL,
      expected: PASS
    },
    {
      name: 'passes insecure Wi-Fi when policy is PASS',
      activeWifiSecure: false,
      policyValue: PASS,
      expected: PASS
    },
    {
      name: 'nudges insecure Wi-Fi when policy is NUDGE',
      activeWifiSecure: false,
      policyValue: NUDGE,
      expected: NUDGE
    },
    {
      name: 'fails insecure Wi-Fi when policy is FAIL',
      activeWifiSecure: false,
      policyValue: FAIL,
      expected: FAIL
    },
    {
      name: 'passes unknown Wi-Fi when policy is FAIL',
      activeWifiSecure: null,
      policyValue: FAIL,
      expected: PASS
    }
  ])('$name', ({ activeWifiSecure, policyValue, expected }) => {
    const result = evaluateDevice(
      createDevice({
        activeWifiSecure,
        activeWifiAssessment:
          activeWifiSecure === false
            ? {
                status: 'insecure',
                reason: 'no-password',
                reasonText: 'does not require a password',
                securityLabel: 'Open',
                detail: 'Current Wi-Fi "Guest" does not require a password.'
              }
            : activeWifiSecure == null
              ? {
                  status: 'unknown',
                  reason: 'unknown',
                  reasonText: 'security could not be determined',
                  securityLabel: 'Unknown',
                  detail: 'Current Wi-Fi security could not be determined.'
                }
              : {
                  status: 'secure',
                  reason: 'modern-protocol',
                  reasonText: 'uses a modern security mode',
                  securityLabel: 'WPA2 Personal',
                  detail:
                    'Current Wi-Fi "OfficeNet" uses a modern security mode: WPA2 Personal.'
                }
      }),
      createPolicy({ activeWifiNetwork: policyValue })
    )

    expect(result.activeWifiNetwork).toBe(expected)
  })

  it('uses macOS no-password detail and remediation steps', () => {
    const result = evaluateDevice(
      createDevice({
        activeWifiSecure: false,
        activeWifiAssessment: {
          status: 'insecure',
          reason: 'no-password',
          reasonText: 'does not require a password',
          securityLabel: 'Open',
          detail: 'Current Wi-Fi "Guest" does not require a password.'
        }
      }),
      createPolicy({ activeWifiNetwork: NUDGE })
    )

    const activeWifi = result.elements.find(
      (item) => item.key === 'activeWifiNetwork'
    )

    expect(activeWifi).toMatchObject({
      status: NUDGE,
      detail:
        'Current Wi-Fi "Guest" does not require a password. Security type: Open. Use a password-protected WPA2 or WPA3 network.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Choose ',
          linkText: 'Wi-Fi',
          linkUrl:
            'x-apple.systempreferences:com.apple.wifi-settings-extension',
          suffix:
            ' to see your current Wi-Fi connection and other available networks.'
        },
        {
          text: 'Disconnect from the current Wi-Fi network:',
          children: [
            {
              text: 'Click Details next to the currently connected Wi-Fi network.'
            },
            { text: 'Click Forget This Network.' },
            { text: 'Confirm or remove the network if prompted.' }
          ]
        },
        {
          text: 'Connect to a secure Wi-Fi network:',
          children: [
            {
              text: 'Select a password-protected WPA2 or WPA3 network from the available Wi-Fi networks.'
            },
            { text: 'Enter the network password if prompted.' },
            { text: 'Click Connect.' }
          ]
        }
      ]
    })
  })

  it('uses Windows weak-protocol detail and remediation steps', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        activeWifiSecure: false,
        activeWifiAssessment: {
          status: 'insecure',
          reason: 'weak-protocol',
          reasonText: 'uses weak Wi-Fi security',
          securityLabel: 'WPA-Personal / TKIP',
          detail: 'Current Wi-Fi "Office" uses a weak security mode.'
        }
      }),
      createPolicy({ activeWifiNetwork: FAIL })
    )

    const activeWifi = result.elements.find(
      (item) => item.key === 'activeWifiNetwork'
    )

    expect(activeWifi).toMatchObject({
      status: FAIL,
      detail:
        'Current Wi-Fi "Office" uses a weak security mode. Security type: WPA-Personal / TKIP. Use a WPA2 or WPA3 network.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Wi-Fi',
          action: 'openWifiSettings',
          suffix: ' in Settings.'
        },
        { text: 'Click Show available networks.' },
        { text: 'Click Disconnect to disconnect the current Wi-Fi network.' },
        {
          text: 'Connect to a secure Wi-Fi network:',
          children: [
            {
              text: 'Select a password-protected WPA2 or WPA3 network from the available Wi-Fi networks list.'
            },
            { text: 'Enter the network password if prompted.' },
            { text: 'Click Connect.' }
          ]
        }
      ]
    })
  })

  it('uses pass-safe wording when Wi-Fi security is unknown', () => {
    const result = evaluateDevice(
      createDevice({
        activeWifiSecure: null,
        activeWifiAssessment: {
          status: 'unknown',
          reason: 'unknown',
          reasonText: 'security could not be determined',
          securityLabel: 'Unknown',
          detail: 'Current Wi-Fi security could not be determined.'
        }
      }),
      createPolicy({ activeWifiNetwork: FAIL })
    )

    const activeWifi = result.elements.find(
      (item) => item.key === 'activeWifiNetwork'
    )

    expect(result.activeWifiNetwork).toBe(PASS)
    expect(activeWifi).toMatchObject({
      status: PASS,
      detail: 'Current Wi-Fi security could not be determined.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Choose ',
          linkText: 'Wi-Fi',
          linkUrl:
            'x-apple.systempreferences:com.apple.wifi-settings-extension',
          suffix:
            ' to see your current Wi-Fi connection and other available networks.'
        },
        {
          text: 'When possible, connect to a password-protected WPA2 or WPA3 network.'
        }
      ]
    })
  })
})

describe('evaluateDevice known Wi-Fi result', () => {
  it.each([
    {
      name: 'passes secure saved networks regardless of fail policy',
      knownWifiSecure: true,
      policyValue: FAIL,
      expected: PASS
    },
    {
      name: 'passes insecure saved networks when policy is PASS',
      knownWifiSecure: false,
      policyValue: PASS,
      expected: PASS
    },
    {
      name: 'nudges insecure saved networks when policy is NUDGE',
      knownWifiSecure: false,
      policyValue: NUDGE,
      expected: NUDGE
    },
    {
      name: 'fails insecure saved networks when policy is FAIL',
      knownWifiSecure: false,
      policyValue: FAIL,
      expected: FAIL
    },
    {
      name: 'passes unknown saved networks when policy is FAIL',
      knownWifiSecure: null,
      policyValue: FAIL,
      expected: PASS
    }
  ])('$name', ({ knownWifiSecure, policyValue, expected }) => {
    const result = evaluateDevice(
      createDevice({
        knownWifiSecure,
        knownWifiAssessment:
          knownWifiSecure === false
            ? {
                status: 'insecure',
                detail:
                  'This device remembers one or more insecure Wi-Fi networks.',
                networkCount: 2,
                insecureNetworks: [
                  {
                    ssid: 'Library Wi-Fi',
                    status: 'insecure',
                    reason: 'no-password',
                    reasonText:
                      'encrypts Wi-Fi traffic but does not require a password',
                    securityLabel: 'Enhanced Open'
                  }
                ]
              }
            : knownWifiSecure == null
              ? {
                  status: 'unknown',
                  detail: 'Saved Wi-Fi networks could not be checked.',
                  networkCount: 0,
                  insecureNetworks: []
                }
              : {
                  status: 'secure',
                  detail:
                    'No insecure saved Wi-Fi networks were found on this device.',
                  networkCount: 3,
                  insecureNetworks: []
                }
      }),
      createPolicy({ knownWifiNetworks: policyValue })
    )

    expect(result.knownWifiNetworks).toBe(expected)
  })

  it('lists insecure saved networks in macOS remediation steps', () => {
    const result = evaluateDevice(
      createDevice({
        knownWifiSecure: false,
        knownWifiAssessment: {
          status: 'insecure',
          detail: 'This device remembers one or more insecure Wi-Fi networks.',
          networkCount: 2,
          insecureNetworks: [
            {
              ssid: 'Old Router',
              status: 'insecure',
              reason: 'weak-protocol',
              reasonText: 'uses outdated WPA security',
              securityLabel: 'WPA Personal'
            },
            {
              ssid: 'Cafe Guest',
              status: 'insecure',
              reason: 'no-password',
              reasonText: 'does not require a password',
              securityLabel: 'Open'
            }
          ]
        }
      }),
      createPolicy({ knownWifiNetworks: NUDGE })
    )

    const knownWifi = result.elements.find(
      (item) => item.key === 'knownWifiNetworks'
    )

    expect(knownWifi).toMatchObject({
      status: NUDGE,
      detail: 'This device remembers one or more insecure Wi-Fi networks.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Select ',
          linkText: 'Wi-Fi',
          linkUrl:
            'x-apple.systempreferences:com.apple.wifi-settings-extension',
          suffix: ' from the sidebar.'
        },
        {
          text: 'Click Advanced to see saved Wi-Fi networks known to this device.'
        },
        {
          text: 'Remove each insecure saved Wi-Fi network using these steps:',
          children: [
            {
              text: 'Click the circle with three dots next to the network name.'
            },
            { text: 'Click Remove from List.' },
            { text: 'Click Remove or Forget if prompted.' }
          ]
        },
        {
          text: 'List of insecure saved Wi-Fi networks:',
          unnumbered: true,
          bold: true,
          children: [
            { text: 'Cafe Guest - Open - does not require a password' },
            {
              text: 'Old Router - WPA Personal - uses outdated WPA security'
            }
          ]
        }
      ]
    })
  })

  it('uses Windows Wi-Fi settings action for known network remediation', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        knownWifiSecure: false,
        knownWifiAssessment: {
          status: 'insecure',
          detail: 'This device remembers one or more insecure Wi-Fi networks.',
          networkCount: 2,
          insecureNetworks: [
            {
              ssid: 'Zoo Wi-Fi',
              profileName: 'Zoo Wi-Fi',
              status: 'insecure',
              reason: 'weak-protocol',
              reasonText: 'uses outdated WPA security',
              securityLabel: 'WPA Personal'
            },
            {
              ssid: 'Airport Wi-Fi',
              profileName: 'Airport Wi-Fi',
              status: 'insecure',
              reason: 'no-password',
              reasonText: 'does not require a password',
              securityLabel: 'Open'
            }
          ]
        }
      }),
      createPolicy({ knownWifiNetworks: FAIL })
    )

    const knownWifi = result.elements.find(
      (item) => item.key === 'knownWifiNetworks'
    )

    expect(knownWifi).toMatchObject({
      status: FAIL,
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Wi-Fi',
          action: 'openWifiSettings',
          suffix: ' in Settings.'
        },
        { text: 'Click Manage known networks.' },
        {
          text: 'Remove each insecure saved Wi-Fi network using these steps:',
          children: [{ text: 'Select the network.' }, { text: 'Click Forget.' }]
        },
        {
          text: 'List of insecure saved Wi-Fi networks:',
          unnumbered: true,
          bold: true,
          children: [
            { text: 'Airport Wi-Fi - Open - does not require a password' },
            { text: 'Zoo Wi-Fi - WPA Personal - uses outdated WPA security' }
          ]
        }
      ]
    })
  })
})

describe('evaluateDevice screen idle result', () => {
  it.each([
    {
      name: 'passes when policy is not configured',
      policyValue: null,
      deviceValue: { kind: 'seconds' as const, seconds: 600 },
      expected: PASS,
      detail: 'Company policy: N/A. Your setting: 10 minutes.'
    },
    {
      name: 'passes when policy is not configured and screen saver is set to never',
      policyValue: null,
      deviceValue: { kind: 'never' as const },
      expected: PASS,
      detail: 'Company policy: N/A. Your setting: Never.'
    },
    {
      name: 'passes when policy is not configured and device setting is unknown',
      policyValue: null,
      deviceValue: { kind: 'unknown' as const },
      expected: PASS,
      detail: 'Company policy: N/A. Your setting: Unknown.'
    },
    {
      name: 'passes when device setting is unknown',
      policyValue: 300,
      deviceValue: { kind: 'unknown' as const },
      expected: PASS,
      detail: 'Screen idle setting could not be determined.'
    },
    {
      name: 'fails when screen saver is set to never',
      policyValue: 300,
      deviceValue: { kind: 'never' as const },
      expected: FAIL,
      detail: 'Company policy: 5 minutes. Your setting: Never.'
    },
    {
      name: 'fails when idle timeout is greater than policy',
      policyValue: 300,
      deviceValue: { kind: 'seconds' as const, seconds: 301 },
      expected: FAIL,
      detail: 'Company policy: 5 minutes. Your setting: 5 minutes 1 second.'
    },
    {
      name: 'passes when idle timeout equals policy',
      policyValue: 300,
      deviceValue: { kind: 'seconds' as const, seconds: 300 },
      expected: PASS,
      detail: 'Company policy: 5 minutes. Your setting: 5 minutes.'
    },
    {
      name: 'passes when idle timeout is below policy',
      policyValue: 300,
      deviceValue: { kind: 'seconds' as const, seconds: 60 },
      expected: PASS,
      detail: 'Company policy: 5 minutes. Your setting: 1 minute.'
    }
  ])('$name', ({ policyValue, deviceValue, expected, detail }) => {
    const result = evaluateDevice(
      createDevice({ screenIdleState: deviceValue }),
      createPolicy({ screenIdle: { mac: policyValue, win: null } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(expected)
    expect(screenIdle).toMatchObject({
      status: expected,
      description:
        'Screens which lock automatically when your laptop is unattended help prevent unauthorized access. Your timeout setting should be equal to or less than company policy.',
      detail
    })
  })

  it('uses macOS Screen Idle instructions when idle timeout exceeds policy', () => {
    const result = evaluateDevice(
      createDevice({
        screenIdleState: { kind: 'seconds', seconds: 1800 }
      }),
      createPolicy({ screenIdle: { mac: 900, win: null } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(FAIL)
    expect(screenIdle).toMatchObject({
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Open ',
          linkText: 'Lock Screen',
          linkUrl: 'x-apple.systempreferences:com.apple.Lock',
          suffix: ' on the left.'
        },
        {
          text: 'Adjust the "Start Screen Saver when inactive" dropdown to less than or equal to the company policy (15 minutes).'
        }
      ]
    })
  })

  it('shows N/A in macOS Screen Idle instructions when policy is invalid', () => {
    const result = evaluateDevice(
      createDevice({
        screenIdleState: { kind: 'seconds', seconds: 600 }
      }),
      createPolicy({ screenIdle: { mac: null, win: null } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(PASS)
    expect(screenIdle).toMatchObject({
      detail: 'Company policy: N/A. Your setting: 10 minutes.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Open ',
          linkText: 'Lock Screen',
          linkUrl: 'x-apple.systempreferences:com.apple.Lock',
          suffix: ' on the left.'
        },
        {
          text: 'For the "Start Screen Saver when inactive" dropdown, select a shorter time.',
          children: [
            {
              text: 'Shorter idle times reduce the chance of someone accessing your Mac while it is unattended.'
            }
          ]
        }
      ]
    })
  })

  it('formats Windows Screen Idle values as minutes and seconds', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenIdleState: { kind: 'seconds', seconds: 3900 }
      }),
      createPolicy({ screenIdle: { mac: null, win: 3900 } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(PASS)
    expect(screenIdle).toMatchObject({
      detail: 'Company policy: 65 minutes. Your setting: 65 minutes.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Lock screen settings',
          linkUrl: 'ms-settings:lockscreen',
          suffix: '.'
        },
        {
          text: 'Scroll down and click "Screen saver" to open Screen Saver Settings.'
        },
        {
          text: 'In Screen Saver Settings, set Wait to less than or equal to the company policy (65 minutes).'
        }
      ]
    })
  })

  it('formats Windows disabled Screen Idle as never', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenIdleState: { kind: 'never' }
      }),
      createPolicy({ screenIdle: { mac: null, win: 600 } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(FAIL)
    expect(screenIdle).toMatchObject({
      detail: 'Company policy: 10 minutes. Your setting: Never.'
    })
  })

  it('uses Windows Screen Idle N/A policy instructions', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenIdleState: { kind: 'seconds', seconds: 600 }
      }),
      createPolicy({ screenIdle: { mac: null, win: null } })
    )

    const screenIdle = result.elements.find((item) => item.key === 'screenIdle')

    expect(result.screenIdle).toBe(PASS)
    expect(screenIdle).toMatchObject({
      detail: 'Company policy: N/A. Your setting: 10 minutes.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Lock screen settings',
          linkUrl: 'ms-settings:lockscreen',
          suffix: '.'
        },
        {
          text: 'Scroll down and click "Screen saver" to open Screen Saver Settings.'
        },
        {
          text: 'In Screen Saver Settings, choose a shorter Wait time.',
          children: [
            {
              text: 'Shorter idle times reduce the chance of someone accessing your Windows device while it is unattended.'
            }
          ]
        }
      ]
    })
  })
})

describe('evaluateDevice screen lock result', () => {
  it.each([
    {
      name: 'passes when macOS policy is not configured',
      policyValue: null,
      deviceValue: { kind: 'seconds' as const, seconds: 300 },
      expected: PASS,
      detail: 'Company policy: N/A. Your setting: 5 minutes.'
    },
    {
      name: 'passes when macOS device setting is unknown',
      policyValue: 300,
      deviceValue: { kind: 'unknown' as const },
      expected: PASS,
      detail: 'Company policy: 5 minutes. Your setting: Unknown.'
    },
    {
      name: 'passes when macOS policy requires immediately and device is immediately',
      policyValue: 0,
      deviceValue: { kind: 'immediately' as const },
      expected: PASS,
      detail: 'Company policy: Immediately. Your setting: Immediately.'
    },
    {
      name: 'passes when macOS policy allows a delay and device is immediately',
      policyValue: 300,
      deviceValue: { kind: 'immediately' as const },
      expected: PASS,
      detail: 'Company policy: 5 minutes. Your setting: Immediately.'
    },
    {
      name: 'fails when macOS policy requires immediately and device has a delay',
      policyValue: 0,
      deviceValue: { kind: 'seconds' as const, seconds: 5 },
      expected: FAIL,
      detail: 'Company policy: Immediately. Your setting: 5 seconds.'
    },
    {
      name: 'fails when macOS screen lock is set to never',
      policyValue: 300,
      deviceValue: { kind: 'never' as const },
      expected: FAIL,
      detail: 'Company policy: 5 minutes. Your setting: Never.'
    },
    {
      name: 'fails when macOS lock delay is greater than policy',
      policyValue: 300,
      deviceValue: { kind: 'seconds' as const, seconds: 301 },
      expected: FAIL,
      detail: 'Company policy: 5 minutes. Your setting: 5 minutes 1 second.'
    },
    {
      name: 'passes when macOS lock delay equals policy',
      policyValue: 300,
      deviceValue: { kind: 'seconds' as const, seconds: 300 },
      expected: PASS,
      detail: 'Company policy: 5 minutes. Your setting: 5 minutes.'
    }
  ])('$name', ({ policyValue, deviceValue, expected, detail }) => {
    const result = evaluateDevice(
      createDevice({ screenLockState: deviceValue }),
      createPolicy({ screenLock: { mac: policyValue, win: null } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(expected)
    expect(screenLock).toMatchObject({
      status: expected,
      description:
        'Requiring a password after the screen saver starts or the display turns off helps prevent unauthorized access when your system is unattended. This locks your screen until you enter your password.',
      detail
    })
  })

  it('uses macOS Screen Lock instructions when policy is configured', () => {
    const result = evaluateDevice(
      createDevice({
        screenLockState: { kind: 'seconds', seconds: 1800 }
      }),
      createPolicy({ screenLock: { mac: 900, win: null } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(FAIL)
    expect(screenLock).toMatchObject({
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'Lock Screen',
          linkUrl: 'x-apple.systempreferences:com.apple.Lock',
          suffix: ' on the left.'
        },
        {
          text: 'Set the "Require password after screen saver begins or display is turned off" dropdown to less than or equal to the company policy (15 minutes).'
        }
      ]
    })
  })

  it('uses macOS Screen Lock N/A policy instructions', () => {
    const result = evaluateDevice(
      createDevice({
        screenLockState: { kind: 'seconds', seconds: 300 }
      }),
      createPolicy({ screenLock: { mac: null, win: null } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(PASS)
    expect(screenLock).toMatchObject({
      detail: 'Company policy: N/A. Your setting: 5 minutes.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'Lock Screen',
          linkUrl: 'x-apple.systempreferences:com.apple.Lock',
          suffix: ' on the left.'
        },
        {
          text: 'Set the "Require password after screen saver begins or display is turned off" dropdown to a shorter time.',
          children: [
            {
              text: 'Shorter lock times reduce the chance of someone accessing your Mac while it is unattended.'
            }
          ]
        }
      ]
    })
  })

  it.each([
    {
      name: 'passes when Windows policy requires logon and setting is required',
      policyValue: 1,
      deviceValue: { kind: 'required' as const },
      expected: PASS,
      detail:
        'Company policy: Logon screen required on resume. Your setting: Logon screen required on resume.'
    },
    {
      name: 'fails when Windows policy requires logon and setting is not required',
      policyValue: 1,
      deviceValue: { kind: 'notRequired' as const },
      expected: FAIL,
      detail:
        'Company policy: Logon screen required on resume. Your setting: Logon screen not required on resume.'
    },
    {
      name: 'passes when Windows policy does not require logon',
      policyValue: 0,
      deviceValue: { kind: 'notRequired' as const },
      expected: PASS,
      detail:
        'Company policy: Logon screen not required on resume. Your setting: Logon screen not required on resume.'
    },
    {
      name: 'passes when Windows policy does not require logon and setting is required',
      policyValue: 0,
      deviceValue: { kind: 'required' as const },
      expected: PASS,
      detail:
        'Company policy: Logon screen not required on resume. Your setting: Logon screen required on resume.'
    },
    {
      name: 'passes when Windows policy requires logon and setting is unknown',
      policyValue: 1,
      deviceValue: { kind: 'unknown' as const },
      expected: PASS,
      detail:
        'Company policy: Logon screen required on resume. Your setting: Unknown.'
    },
    {
      name: 'passes when Windows policy is not configured',
      policyValue: null,
      deviceValue: { kind: 'unknown' as const },
      expected: PASS,
      detail: 'Company policy: N/A. Your setting: Unknown.'
    }
  ])('$name', ({ policyValue, deviceValue, expected, detail }) => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenLockState: deviceValue
      }),
      createPolicy({ screenLock: { mac: null, win: policyValue } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(expected)
    expect(screenLock).toMatchObject({
      status: expected,
      detail
    })
  })

  it('uses Windows Screen Lock required policy instructions', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenLockState: { kind: 'required' }
      }),
      createPolicy({ screenLock: { mac: null, win: 1 } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(PASS)
    expect(screenLock).toMatchObject({
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Lock screen settings',
          linkUrl: 'ms-settings:lockscreen',
          suffix: '.'
        },
        {
          text: 'Scroll down and click "Screen saver" to open Screen Saver Settings.'
        },
        {
          text: 'In Screen Saver Settings, make sure "On resume, display logon screen" is checked.'
        }
      ]
    })
  })

  it('uses Windows Screen Lock N/A policy instructions', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        screenLockState: { kind: 'notRequired' }
      }),
      createPolicy({ screenLock: { mac: null, win: null } })
    )

    const screenLock = result.elements.find((item) => item.key === 'screenLock')

    expect(result.screenLock).toBe(PASS)
    expect(screenLock).toMatchObject({
      detail:
        'Company policy: N/A. Your setting: Logon screen not required on resume.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Lock screen settings',
          linkUrl: 'ms-settings:lockscreen',
          suffix: '.'
        },
        {
          text: 'Scroll down and click "Screen saver" to open Screen Saver Settings.'
        },
        {
          text: 'In Screen Saver Settings, turn on "On resume, display logon screen".',
          children: [
            {
              text: 'Requiring logon on resume reduces the chance of someone accessing your Windows device while it is unattended.'
            }
          ]
        }
      ]
    })
  })
})

describe('evaluateDevice automatic updates result', () => {
  it('shows macOS checklist details when a required automatic update setting is disabled', () => {
    const result = evaluateDevice(
      createDevice({
        automaticUpdatesEnabled: false,
        automaticUpdates: {
          enabled: false,
          checks: [
            {
              key: 'automaticDownloadUpdates',
              label: 'Download new updates when available',
              enabled: true
            },
            {
              key: 'automaticOsUpdates',
              label: 'Install macOS updates',
              enabled: false
            },
            {
              key: 'automaticAppUpdates',
              label: 'Install application updates from the App Store',
              enabled: true
            },
            {
              key: 'automaticSecurityUpdates',
              label: 'Install Security Responses and system files',
              enabled: true
            }
          ],
          mojaveOrLater: true,
          tahoeOrLater: false
        }
      }),
      createPolicy({ automaticUpdates: FAIL })
    )

    const automaticUpdates = result.elements.find(
      (item) => item.key === 'automaticUpdates'
    )

    expect(result.automaticUpdates).toBe(FAIL)
    expect(automaticUpdates).toMatchObject({
      status: FAIL,
      detail: 'One or more automatic update settings appear disabled.',
      description:
        'One of the most important things you can do to secure your device(s) is to keep your operating system and software up to date. New vulnerabilities and weaknesses are found every day so frequent updates are essential to ensuring your device(s) include the latest fixes and preventative measures. Enabling automatic updating helps ensure your machine is up-to-date without having to manually install updates.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'Software Update',
          linkUrl:
            'x-apple.systempreferences:com.apple.preferences.softwareupdate',
          suffix: '.'
        },
        {
          text: 'Click on the info icon in front of Automatic Updates and make sure the following are checked:',
          children: [
            {
              text: 'Download new updates when available',
              status: PASS
            },
            { text: 'Install macOS updates', status: FAIL },
            {
              text: 'Install application updates from the App Store',
              status: PASS
            },
            {
              text: 'Install Security Responses and system files',
              status: PASS
            }
          ]
        }
      ],
      fixInstruction:
        'Open Software Update settings and turn on automatic updates.'
    })
  })

  it('does not penalize the user when automatic update settings cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({
        automaticUpdatesEnabled: null,
        automaticUpdates: {
          enabled: null,
          checks: [
            {
              key: 'automaticDownloadUpdates',
              label: 'Download new updates when available',
              enabled: null
            }
          ],
          mojaveOrLater: true,
          tahoeOrLater: false
        }
      }),
      createPolicy({ automaticUpdates: FAIL })
    )

    const automaticUpdates = result.elements.find(
      (item) => item.key === 'automaticUpdates'
    )

    expect(result.automaticUpdates).toBe(PASS)
    expect(automaticUpdates).toMatchObject({
      status: PASS,
      detail: 'Automatic update settings could not be fully verified.',
      fixInstruction: 'No action required.'
    })
  })

  it('shows macOS checklist details when automatic updates pass', () => {
    const result = evaluateDevice(
      createDevice(),
      createPolicy({ automaticUpdates: FAIL })
    )

    const automaticUpdates = result.elements.find(
      (item) => item.key === 'automaticUpdates'
    )

    expect(result.automaticUpdates).toBe(PASS)
    expect(automaticUpdates).toMatchObject({
      status: PASS,
      detail: 'Automatic updates appear enabled.',
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'Software Update',
          linkUrl:
            'x-apple.systempreferences:com.apple.preferences.softwareupdate',
          suffix: '.'
        },
        {
          text: 'Click on the info icon in front of Automatic Updates and make sure the following are checked:',
          children: [
            {
              text: 'Download new updates when available',
              status: PASS
            },
            { text: 'Install macOS updates', status: PASS },
            {
              text: 'Install application updates from the App Store',
              status: PASS
            },
            {
              text: 'Install Security Responses and system files',
              status: PASS
            }
          ]
        }
      ]
    })
  })

  it('adds App Store action steps for Tahoe automatic app updates', () => {
    const result = evaluateDevice(
      createDevice({
        automaticUpdatesEnabled: false,
        automaticUpdates: {
          enabled: false,
          checks: [
            {
              key: 'automaticDownloadUpdates',
              label: 'Download new updates when available',
              enabled: true
            },
            {
              key: 'automaticOsUpdates',
              label: 'Install macOS updates',
              enabled: true
            },
            {
              key: 'automaticAppUpdates',
              label: 'Install application updates from the App Store',
              enabled: false
            },
            {
              key: 'automaticSecurityUpdates',
              label: 'Install Security Responses and system files',
              enabled: true
            }
          ],
          mojaveOrLater: true,
          tahoeOrLater: true
        }
      }),
      createPolicy({ automaticUpdates: FAIL })
    )

    const automaticUpdates = result.elements.find(
      (item) => item.key === 'automaticUpdates'
    )

    expect(automaticUpdates?.descriptionSteps).toContainEqual({
      text: 'Open ',
      linkText: 'App Store',
      action: 'openAppStore',
      suffix: '.'
    })
  })

  it('uses Windows Resume updates instructions when updates are paused', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        automaticUpdatesEnabled: false,
        automaticUpdates: {
          enabled: false,
          checks: [
            {
              key: 'windowsUpdatesNotPaused',
              label: 'Windows updates are not paused',
              enabled: false
            }
          ],
          mojaveOrLater: null,
          tahoeOrLater: null
        }
      }),
      createPolicy({ automaticUpdates: FAIL })
    )

    const automaticUpdates = result.elements.find(
      (item) => item.key === 'automaticUpdates'
    )

    expect(result.automaticUpdates).toBe(FAIL)
    expect(automaticUpdates).toMatchObject({
      status: FAIL,
      detail: 'Windows updates appear to be paused.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'Windows Update',
          linkUrl: 'ms-settings:windowsupdate',
          suffix: ' settings.'
        },
        {
          text: 'Click on the "Resume updates" button to enable automatic updates.'
        }
      ],
      fixInstruction: 'Open Windows Update settings and click Resume updates.'
    })
  })
})

describe('evaluateDevice remote login result', () => {
  it('uses macOS Remote Login instructions when remote login is enabled', () => {
    const result = evaluateDevice(
      createDevice({
        remoteLoginEnabled: true
      }),
      createPolicy({ remoteLogin: { mac: FAIL, win: FAIL } })
    )

    const remoteLogin = result.elements.find(
      (item) => item.key === 'remoteLogin'
    )

    expect(result.remoteLogin).toBe(FAIL)
    expect(remoteLogin).toMatchObject({
      status: FAIL,
      detail: 'Remote Login is allowed.',
      description:
        "The 'Remote Login' setting on your device controls whether users can login remotely to the system.",
      descriptionSteps: [
        { text: 'Choose System Settings from the Apple menu.' },
        {
          text: 'Click ',
          linkText: 'Sharing',
          linkUrl:
            'x-apple.systempreferences:com.apple.preferences.sharing?Services_RemoteLogin',
          suffix: '.'
        },
        { text: 'Uncheck "Remote Login".' }
      ],
      fixInstruction:
        'Open System Settings > Sharing and turn Remote Login off.'
    })
  })

  it('passes when remote login is disabled', () => {
    const result = evaluateDevice(
      createDevice({
        remoteLoginEnabled: false
      }),
      createPolicy({ remoteLogin: { mac: FAIL, win: FAIL } })
    )

    const remoteLogin = result.elements.find(
      (item) => item.key === 'remoteLogin'
    )

    expect(result.remoteLogin).toBe(PASS)
    expect(remoteLogin).toMatchObject({
      status: PASS,
      detail: 'Remote Login is not allowed.',
      fixInstruction: 'No action required.'
    })
  })

  it('does not penalize the user when remote login cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({
        remoteLoginEnabled: null
      }),
      createPolicy({ remoteLogin: { mac: FAIL, win: FAIL } })
    )

    const remoteLogin = result.elements.find(
      (item) => item.key === 'remoteLogin'
    )

    expect(result.remoteLogin).toBe(PASS)
    expect(remoteLogin).toMatchObject({
      status: PASS,
      detail: 'Remote login status could not be determined.',
      fixInstruction: 'Disable remote login unless explicitly required.'
    })
  })

  it('uses Windows Remote Desktop instructions when remote login is enabled', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true,
        remoteLoginEnabled: true
      }),
      createPolicy({ remoteLogin: { mac: FAIL, win: FAIL } })
    )

    const remoteLogin = result.elements.find(
      (item) => item.key === 'remoteLogin'
    )

    expect(result.remoteLogin).toBe(FAIL)
    expect(remoteLogin).toMatchObject({
      status: FAIL,
      detail: 'Remote Login is allowed.',
      descriptionSteps: [
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
      ],
      fixInstruction:
        'Open Advanced System Preferences and disable Remote Desktop connections.'
    })
  })
})

describe('evaluateDevice Network ID result', () => {
  it('passes when Network ID policy is PASS even if the current IP is not allowed', () => {
    const result = evaluateDevice(
      createDevice({ networkIdInUse: '2.2.2.2' }),
      createPolicy({ networkId: PASS, networkIdIps: '1.1.1.1' })
    )

    const networkId = result.elements.find((item) => item.key === 'networkId')

    expect(result.networkID).toBe(PASS)
    expect(result.networkIDInUse).toBe('2.2.2.2')
    expect(networkId).toMatchObject({
      title: 'Network ID',
      status: PASS,
      detail: 'Network ID in use: 2.2.2.2',
      description: 'Network ID matches an approved network.',
      descriptionSteps: [
        { text: 'Allowed Network IDs: 1.1.1.1', unnumbered: true }
      ],
      fixInstruction: 'No action required.'
    })
  })

  it('passes when current IP is in the comma-separated allowed list', () => {
    const result = evaluateDevice(
      createDevice({ networkIdInUse: '2.2.2.2' }),
      createPolicy({
        networkId: FAIL,
        networkIdIps: ' 1.1.1.1, 2.2.2.2, 3.3.3.3 '
      })
    )

    const networkId = result.elements.find((item) => item.key === 'networkId')

    expect(result.networkID).toBe(PASS)
    expect(networkId).toMatchObject({
      status: PASS,
      detail: 'Network ID in use: 2.2.2.2',
      descriptionSteps: [
        {
          text: 'Allowed Network IDs: 1.1.1.1, 2.2.2.2, 3.3.3.3',
          unnumbered: true
        }
      ]
    })
  })

  it('applies NUDGE when current IP is not in the allowed list', () => {
    const result = evaluateDevice(
      createDevice({ networkIdInUse: '4.4.4.4' }),
      createPolicy({
        networkId: NUDGE,
        networkIdIps: '1.1.1.1, 2.2.2.2, 3.3.3.3'
      })
    )

    const networkId = result.elements.find((item) => item.key === 'networkId')

    expect(result.networkID).toBe(NUDGE)
    expect(networkId).toMatchObject({
      status: NUDGE,
      detail:
        'You are not connected to an approved network. Please contact your company administrator for further instructions.',
      description: '',
      descriptionSteps: [
        { text: 'Network ID in use: 4.4.4.4', unnumbered: true },
        {
          text: 'Allowed Network IDs: 1.1.1.1, 2.2.2.2, 3.3.3.3',
          unnumbered: true
        }
      ],
      fixInstruction: 'Connect from an approved network.'
    })
  })

  it('applies FAIL when allowed IPs are empty and policy requires enforcement', () => {
    const result = evaluateDevice(
      createDevice({ networkIdInUse: '2.2.2.2' }),
      createPolicy({ networkId: FAIL, networkIdIps: '' })
    )

    const networkId = result.elements.find((item) => item.key === 'networkId')

    expect(result.networkID).toBe(FAIL)
    expect(networkId).toMatchObject({
      status: FAIL,
      detail:
        'You are not connected to an approved network. Please contact your company administrator for further instructions.',
      descriptionSteps: [
        { text: 'Network ID in use: 2.2.2.2', unnumbered: true },
        { text: 'Allowed Network IDs: Not configured', unnumbered: true }
      ]
    })
  })

  it('passes with an unknown message when current public IP cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({ networkIdInUse: '' }),
      createPolicy({ networkId: FAIL, networkIdIps: '1.1.1.1' })
    )

    const networkId = result.elements.find((item) => item.key === 'networkId')

    expect(result.networkID).toBe(PASS)
    expect(result.networkIDInUse).toBe('')
    expect(networkId).toMatchObject({
      status: PASS,
      detail: 'Network ID could not be determined.',
      description: 'Network ID could not be determined.',
      descriptionSteps: [
        { text: 'Network ID in use: Not available', unnumbered: true },
        { text: 'Allowed Network IDs: 1.1.1.1', unnumbered: true }
      ],
      fixInstruction: 'Check your internet connection, then run the scan again.'
    })
  })
})

describe('evaluateDevice Windows Defender AV result', () => {
  it('passes when Microsoft Defender real-time protection is enabled', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: true
      }),
      createPolicy({ winDefenderAV: FAIL })
    )

    const antivirus = result.elements.find(
      (item) => item.key === 'winDefenderAV'
    )

    expect(result.winDefenderAV).toBe(PASS)
    expect(antivirus).toMatchObject({
      title: 'Antivirus',
      status: PASS,
      detail:
        'Antivirus is currently providing real-time protection on your system.',
      descriptionSteps: [
        {
          text: 'Click ',
          linkText: 'here',
          linkUrl: 'windowsdefender://threat',
          suffix: ' to check other antivirus protection settings.'
        }
      ],
      description:
        'Real-time protection helps detect and block malware before it can install or run on your device.',
      fixInstruction: 'No action required.'
    })
  })

  it('fails when Microsoft Defender real-time protection is disabled', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: false
      }),
      createPolicy({ winDefenderAV: FAIL })
    )

    const antivirus = result.elements.find(
      (item) => item.key === 'winDefenderAV'
    )

    expect(result.winDefenderAV).toBe(FAIL)
    expect(antivirus).toMatchObject({
      status: FAIL,
      detail:
        'Antivirus is not currently providing real-time protection on your system.',
      descriptionSteps: [
        {
          text: 'Click ',
          linkText: 'here',
          linkUrl: 'windowsdefender://threatsettings/',
          suffix: ' to turn on real-time protection.'
        }
      ],
      fixInstruction:
        'Open Virus & threat protection settings and turn on real-time protection.'
    })
  })

  it('does not penalize the user when Microsoft Defender status cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        winDefenderEnabled: null
      }),
      createPolicy({ winDefenderAV: FAIL })
    )

    const antivirus = result.elements.find(
      (item) => item.key === 'winDefenderAV'
    )

    expect(result.winDefenderAV).toBe(PASS)
    expect(antivirus).toMatchObject({
      status: PASS,
      detail:
        'Antivirus is not currently providing real-time protection on your system.',
      descriptionSteps: [
        {
          text: 'If you are using another antivirus program, please make sure it is actively running and providing real-time protection. Click ',
          linkText: 'here',
          linkUrl: 'windowsdefender://threat',
          suffix: ' to open the Virus and threat protection settings.'
        }
      ],
      fixInstruction:
        'If you are using another antivirus program, make sure it is actively running and providing real-time protection.'
    })
  })

  it('does not add an Antivirus row on macOS', () => {
    const result = evaluateDevice(
      createDevice(),
      createPolicy({ winDefenderAV: FAIL })
    )

    expect(result.winDefenderAV).toBe(PASS)
    expect(
      result.elements.find((item) => item.key === 'winDefenderAV')
    ).toBeUndefined()
  })
})

describe('evaluateDevice disk encryption result', () => {
  it('uses macOS FileVault instructions when disk encryption is disabled', () => {
    const result = evaluateDevice(
      createDevice({
        diskEncryptionEnabled: false,
        diskEncryptionState: 'disabled'
      }),
      createPolicy({ diskEncryption: FAIL })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(FAIL)
    expect(diskEncryption).toMatchObject({
      status: FAIL,
      description:
        "Full-disk encryption protects data at rest from being accessed by a party who does not know the password or decryption key. Systems containing internal data should be encrypted. It is every employee's responsibility to keep internal data safe.",
      descriptionSteps: [
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
      ],
      detail: 'FileVault is turned off.',
      fixInstruction: 'Turn on FileVault.'
    })
  })

  it('treats FileVault encryption in progress as passing', () => {
    const result = evaluateDevice(
      createDevice({
        diskEncryptionEnabled: true,
        diskEncryptionState: 'encrypting'
      }),
      createPolicy({ diskEncryption: FAIL })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(PASS)
    expect(diskEncryption).toMatchObject({
      status: PASS,
      detail: 'FileVault encryption is in progress.',
      fixInstruction:
        'No action required. Keep the device powered on until encryption completes.'
    })
  })

  it('treats FileVault decryption in progress as not passing', () => {
    const result = evaluateDevice(
      createDevice({
        diskEncryptionEnabled: false,
        diskEncryptionState: 'decrypting'
      }),
      createPolicy({ diskEncryption: NUDGE })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(NUDGE)
    expect(diskEncryption).toMatchObject({
      status: NUDGE,
      detail: 'FileVault decryption is in progress.',
      fixInstruction: 'Stop decryption and keep FileVault turned on.'
    })
  })

  it('does not penalize the user when disk encryption state cannot be determined', () => {
    const result = evaluateDevice(
      createDevice({
        diskEncryptionEnabled: null,
        diskEncryptionState: 'unknown'
      }),
      createPolicy({ diskEncryption: FAIL })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(PASS)
    expect(diskEncryption).toMatchObject({
      status: PASS,
      detail: 'Disk encryption status could not be determined.',
      fixInstruction: 'Ensure FileVault is turned on.'
    })
  })

  it('uses Windows BitLocker instructions', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        diskEncryptionEnabled: false,
        diskEncryptionState: 'disabled',
        winDefenderEnabled: true
      }),
      createPolicy({ diskEncryption: FAIL })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(FAIL)
    expect(diskEncryption).toMatchObject({
      status: FAIL,
      detail:
        'BitLocker appears to be turned off for the Windows system drive.',
      descriptionSteps: [
        {
          text: 'Open ',
          linkText: 'BitLocker Drive Encryption',
          action: 'openDiskEncryptionSettings'
        },
        { text: 'Find the operating system drive, usually C:.' },
        {
          text: 'Turn on BitLocker or resume protection if it is suspended.'
        },
        { text: 'Follow the prompts to save the recovery key.' },
        {
          text: 'Start encryption and keep the device connected to power until encryption completes.'
        }
      ],
      fixInstruction: 'Turn on BitLocker for the Windows system drive.'
    })
  })

  it('treats suspended BitLocker protection as not passing', () => {
    const result = evaluateDevice(
      createDevice({
        platformName: 'Microsoft',
        platform: 'win32',
        diskEncryptionEnabled: false,
        diskEncryptionState: 'suspended',
        winDefenderEnabled: true
      }),
      createPolicy({ diskEncryption: FAIL })
    )

    const diskEncryption = result.elements.find(
      (item) => item.key === 'diskEncryption'
    )

    expect(result.diskEncryption).toBe(FAIL)
    expect(diskEncryption).toMatchObject({
      status: FAIL,
      detail: 'BitLocker appears to be suspended for the Windows system drive.',
      fixInstruction:
        'Resume BitLocker protection for the Windows system drive.'
    })
  })
})
