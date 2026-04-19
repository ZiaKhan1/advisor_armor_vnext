import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assessMacKnownWifiProfiles,
  assessWindowsKnownWifiProfiles,
  parseMacKnownWifiProfiles,
  parseWindowsKnownWifiProfiles
} from './known-wifi'

const moduleMocks = vi.hoisted(() => ({
  access: vi.fn(),
  runCommand: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('node:fs/promises', () => ({
  access: moduleMocks.access,
  default: {
    access: moduleMocks.access
  }
}))

vi.mock('../command-runner', () => ({
  runCommand: moduleMocks.runCommand
}))

vi.mock('../logging', () => ({
  logger: moduleMocks.logger
}))

describe('parseMacKnownWifiProfiles', () => {
  it('parses CoreWLAN known network facts', () => {
    expect(
      parseMacKnownWifiProfiles(
        '{"knownNetworks":[{"ssid":"Cafe Guest","security":"Open","securityRawValue":0},{"ssid":"Office","security":"WPA2 Personal","securityRawValue":4}]}'
      )
    ).toEqual([
      {
        ssid: 'Cafe Guest',
        security: 'Open',
        securityRawValue: 0
      },
      {
        ssid: 'Office',
        security: 'WPA2 Personal',
        securityRawValue: 4
      }
    ])
  })

  it('throws when the helper returns an error object', () => {
    expect(() =>
      parseMacKnownWifiProfiles('{"error":"No Wi-Fi configuration found"}')
    ).toThrow('No Wi-Fi configuration found')
  })
})

describe('parseWindowsKnownWifiProfiles', () => {
  it('normalizes array output from netsh projection', () => {
    expect(
      parseWindowsKnownWifiProfiles(
        '[{"ProfileName":"Cafe Guest","SSID":"Cafe Guest","Authentication":["Open"],"Cipher":["None"]}]'
      )
    ).toEqual([
      {
        profileName: 'Cafe Guest',
        ssid: 'Cafe Guest',
        authentication: ['Open'],
        cipher: ['None']
      }
    ])
  })

  it('normalizes single-object output from ConvertTo-Json', () => {
    expect(
      parseWindowsKnownWifiProfiles(
        '{"ProfileName":"Office","SSID":"Office","Authentication":"WPA2-Personal","Cipher":"CCMP"}'
      )
    ).toEqual([
      {
        profileName: 'Office',
        ssid: 'Office',
        authentication: ['WPA2-Personal'],
        cipher: ['CCMP']
      }
    ])
  })
})

describe('assess known Wi-Fi profiles', () => {
  it('flags macOS open, OWE, and weak saved networks', () => {
    const assessment = assessMacKnownWifiProfiles([
      {
        ssid: 'Cafe Guest',
        security: 'Open',
        securityRawValue: 0
      },
      {
        ssid: 'Library Wi-Fi',
        security: 'Enhanced Open',
        securityRawValue: 14
      },
      {
        ssid: 'Old Router',
        security: 'WPA Personal',
        securityRawValue: 2
      },
      {
        ssid: 'Office',
        security: 'WPA2 Personal',
        securityRawValue: 4
      }
    ])

    expect(assessment.status).toBe('insecure')
    expect(assessment.insecureNetworks).toEqual([
      expect.objectContaining({
        ssid: 'Cafe Guest',
        reasonText: 'does not require a password'
      }),
      expect.objectContaining({
        ssid: 'Library Wi-Fi',
        reasonText: 'encrypts Wi-Fi traffic but does not require a password'
      }),
      expect.objectContaining({
        ssid: 'Old Router',
        reasonText: 'uses outdated WPA security'
      })
    ])
  })

  it('treats Windows profiles as insecure if any authentication or cipher is insecure', () => {
    const assessment = assessWindowsKnownWifiProfiles([
      {
        profileName: 'Mixed',
        ssid: 'Mixed',
        authentication: ['WPA2-Personal', 'Open'],
        cipher: ['CCMP']
      },
      {
        profileName: 'Office',
        ssid: 'Office',
        authentication: ['WPA2-Personal'],
        cipher: ['CCMP']
      }
    ])

    expect(assessment.status).toBe('insecure')
    expect(assessment.insecureNetworks).toEqual([
      expect.objectContaining({
        ssid: 'Mixed',
        reasonText: 'does not require a password'
      })
    ])
  })

  it('passes when all readable profiles are secure', () => {
    expect(
      assessWindowsKnownWifiProfiles([
        {
          profileName: 'Office',
          ssid: 'Office',
          authentication: ['WPA2-Personal'],
          cipher: ['CCMP']
        }
      ])
    ).toMatchObject({
      status: 'secure',
      networkCount: 1,
      insecureNetworks: []
    })
  })
})

describe('readKnownWifiSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unknown and logs when the macOS helper is missing', async () => {
    moduleMocks.access.mockRejectedValue(new Error('missing helper'))

    const { readKnownWifiSnapshot } = await import('./known-wifi')
    const snapshot = await readKnownWifiSnapshot('darwin')

    expect(snapshot).toEqual({
      profiles: [],
      assessment: {
        status: 'unknown',
        detail: 'Saved Wi-Fi networks could not be checked.',
        networkCount: 0,
        insecureNetworks: []
      }
    })
    expect(moduleMocks.runCommand).not.toHaveBeenCalled()
    expect(moduleMocks.logger.warn).toHaveBeenCalledWith(
      'macOS known Wi-Fi helper is missing'
    )
    expect(moduleMocks.logger.info).toHaveBeenCalledWith(
      'Known Wi-Fi facts',
      expect.objectContaining({
        profileCount: null,
        insecureCount: 0,
        classification: 'unknown'
      })
    )
  })
})
