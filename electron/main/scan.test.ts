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
