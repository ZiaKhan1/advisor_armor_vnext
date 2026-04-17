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
    knownWifiSecure: true,
    networkIdInUse: '',
    installedApps: [],
    wifiConnections: [],
    screenIdleState: { kind: 'unknown' },
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
      detail: 'Remote login appears enabled.',
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
      detail: 'Remote login appears disabled.',
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
      detail: 'Remote login appears enabled.',
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
