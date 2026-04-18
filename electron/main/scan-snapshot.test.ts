import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutomaticUpdatesSnapshot } from '@shared/models'

const osMocks = vi.hoisted(() => {
  const mocks = {
    hostname: vi.fn(() => 'test-host'),
    machine: vi.fn(() => 'arm64'),
    platform: vi.fn(() => 'darwin'),
    release: vi.fn(() => '24.6.0')
  }

  return {
    ...mocks,
    default: mocks
  }
})

const scanCheckMocks = vi.hoisted(() => ({
  readFirewallEnabled: vi.fn(),
  readDiskEncryptionState: vi.fn(),
  readAutomaticUpdates: vi.fn(),
  readRemoteLoginEnabled: vi.fn(),
  readScreenIdle: vi.fn(),
  readScreenLock: vi.fn(),
  readActiveWifiSnapshot: vi.fn()
}))

vi.mock('node:os', () => osMocks)

vi.mock('./scan-checks/firewall', () => ({
  readFirewallEnabled: scanCheckMocks.readFirewallEnabled
}))

vi.mock('./scan-checks/disk-encryption', () => {
  const isDiskEncryptionOk = (state: string) => {
    if (state === 'enabled' || state === 'encrypting') {
      return true
    }
    if (
      state === 'disabled' ||
      state === 'decrypting' ||
      state === 'suspended'
    ) {
      return false
    }
    return null
  }

  return {
    isDiskEncryptionOk,
    readDiskEncryptionState: scanCheckMocks.readDiskEncryptionState
  }
})

vi.mock('./scan-checks/automatic-updates', () => ({
  readAutomaticUpdates: scanCheckMocks.readAutomaticUpdates
}))

vi.mock('./scan-checks/remote-login', () => ({
  readRemoteLoginEnabled: scanCheckMocks.readRemoteLoginEnabled
}))

vi.mock('./scan-checks/screen-security', () => ({
  readScreenIdle: scanCheckMocks.readScreenIdle,
  readScreenLock: scanCheckMocks.readScreenLock
}))

vi.mock('./scan-checks/active-wifi', () => ({
  readActiveWifiSnapshot: scanCheckMocks.readActiveWifiSnapshot
}))

const automaticUpdates: AutomaticUpdatesSnapshot = {
  enabled: false,
  checks: [
    {
      key: 'automaticOsUpdates',
      label: 'Install macOS updates',
      enabled: false
    }
  ],
  mojaveOrLater: true,
  tahoeOrLater: false
}

describe('readDeviceSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    osMocks.platform.mockReturnValue('darwin')
    scanCheckMocks.readFirewallEnabled.mockResolvedValue(false)
    scanCheckMocks.readDiskEncryptionState.mockResolvedValue('enabled')
    scanCheckMocks.readAutomaticUpdates.mockResolvedValue(automaticUpdates)
    scanCheckMocks.readRemoteLoginEnabled.mockResolvedValue(true)
    scanCheckMocks.readScreenIdle.mockResolvedValue({
      kind: 'seconds',
      seconds: 300
    })
    scanCheckMocks.readScreenLock.mockResolvedValue({
      kind: 'seconds',
      seconds: 5
    })
    scanCheckMocks.readActiveWifiSnapshot.mockResolvedValue({
      facts: {
        ssid: 'OfficeNet',
        security: 'WPA2 Personal',
        securityRawValue: 4
      },
      assessment: {
        status: 'secure',
        reason: 'modern-protocol',
        securityLabel: 'WPA2 Personal',
        detail:
          'Current Wi-Fi "OfficeNet" uses a modern security mode: WPA2 Personal.'
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '203.0.113.10\n'
      })
    )
  })

  it('maps scan-check outputs into the device snapshot', async () => {
    const { readDeviceSnapshot } = await import('./scan')

    const snapshot = await readDeviceSnapshot()

    expect(scanCheckMocks.readFirewallEnabled).toHaveBeenCalledWith('darwin')
    expect(scanCheckMocks.readDiskEncryptionState).toHaveBeenCalledWith(
      'darwin'
    )
    expect(scanCheckMocks.readAutomaticUpdates).toHaveBeenCalledWith('darwin')
    expect(scanCheckMocks.readRemoteLoginEnabled).toHaveBeenCalledWith('darwin')
    expect(scanCheckMocks.readScreenIdle).toHaveBeenCalledWith('darwin')
    expect(scanCheckMocks.readScreenLock).toHaveBeenCalledWith('darwin')
    expect(scanCheckMocks.readActiveWifiSnapshot).toHaveBeenCalledWith('darwin')

    expect(snapshot).toMatchObject({
      deviceName: 'test-host',
      platformName: 'Apple',
      platform: 'darwin',
      osVersion: '24.6.0',
      hardwareModel: 'arm64',
      firewallEnabled: false,
      diskEncryptionEnabled: true,
      diskEncryptionState: 'enabled',
      automaticUpdates,
      automaticUpdatesEnabled: false,
      remoteLoginEnabled: true,
      activeWifiSecure: true,
      activeWifiAssessment: {
        status: 'secure',
        reason: 'modern-protocol',
        securityLabel: 'WPA2 Personal',
        detail:
          'Current Wi-Fi "OfficeNet" uses a modern security mode: WPA2 Personal.'
      },
      wifiConnections: [
        {
          id: 'wifi-1',
          iface: 'en0',
          model: 'Built-in',
          ssid: 'OfficeNet',
          bssid: '00:00:00:00:00:00',
          channel: '36',
          frequency: '5 GHz',
          type: 'wifi',
          security: 'WPA2',
          signalLevel: '-40 dBm',
          txRate: '866 Mbps',
          wpaResult: 'FAIL',
          wpa2Result: 'PASS',
          wpa3Result: 'FAIL'
        }
      ],
      screenIdleState: { kind: 'seconds', seconds: 300 },
      screenIdleSeconds: 300,
      screenLockState: { kind: 'seconds', seconds: 5 },
      screenLockSeconds: 5,
      networkIdInUse: '203.0.113.10'
    })
  })
})
