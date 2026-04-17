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
  readRemoteLoginEnabled: vi.fn()
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
      networkIdInUse: '203.0.113.10'
    })
  })
})
