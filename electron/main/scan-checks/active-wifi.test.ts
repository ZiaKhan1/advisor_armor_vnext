import { describe, expect, it } from 'vitest'
import {
  classifyMacWifiSecurity,
  classifyWindowsWifiSecurity,
  parseWindowsActiveWifiFacts
} from './active-wifi'

describe('classifyMacWifiSecurity', () => {
  it.each([
    {
      name: 'Open',
      raw: 0,
      expectedStatus: 'insecure',
      expectedReason: 'no-password'
    },
    {
      name: 'WEP',
      raw: 1,
      expectedStatus: 'insecure',
      expectedReason: 'weak-protocol'
    },
    {
      name: 'WPA Personal',
      raw: 2,
      expectedStatus: 'insecure',
      expectedReason: 'weak-protocol'
    },
    {
      name: 'WPA/WPA2 Mixed',
      raw: 3,
      expectedStatus: 'insecure',
      expectedReason: 'weak-protocol'
    },
    {
      name: 'WPA2 Personal',
      raw: 4,
      expectedStatus: 'secure',
      expectedReason: 'modern-protocol'
    },
    {
      name: 'WPA3 Personal',
      raw: 11,
      expectedStatus: 'secure',
      expectedReason: 'modern-protocol'
    },
    {
      name: 'Enhanced Open',
      raw: 14,
      expectedStatus: 'insecure',
      expectedReason: 'no-password'
    },
    {
      name: 'Unknown generic personal',
      raw: 5,
      expectedStatus: 'unknown',
      expectedReason: 'unknown'
    }
  ])('classifies $name', ({ raw, expectedStatus, expectedReason }) => {
    const assessment = classifyMacWifiSecurity({
      ssid: 'OfficeNet',
      security: 'Detected security',
      securityRawValue: raw
    })

    expect(assessment.status).toBe(expectedStatus)
    expect(assessment.reason).toBe(expectedReason)
    expect(assessment.detail).toContain('OfficeNet')
  })
})

describe('classifyWindowsWifiSecurity', () => {
  it.each([
    {
      authentication: 'Open',
      cipher: 'None',
      expectedStatus: 'insecure',
      expectedReason: 'no-password'
    },
    {
      authentication: 'OWE',
      cipher: 'CCMP',
      expectedStatus: 'insecure',
      expectedReason: 'no-password'
    },
    {
      authentication: 'WPA-Personal',
      cipher: 'TKIP',
      expectedStatus: 'insecure',
      expectedReason: 'weak-protocol'
    },
    {
      authentication: 'WPA2-Personal',
      cipher: 'CCMP',
      expectedStatus: 'secure',
      expectedReason: 'modern-protocol'
    },
    {
      authentication: 'WPA2PSK',
      cipher: 'GCMP-256',
      expectedStatus: 'secure',
      expectedReason: 'modern-protocol'
    },
    {
      authentication: 'Vendor specific',
      cipher: 'Vendor specific',
      expectedStatus: 'unknown',
      expectedReason: 'unknown'
    }
  ])(
    'classifies $authentication / $cipher',
    ({ authentication, cipher, expectedStatus, expectedReason }) => {
      const assessment = classifyWindowsWifiSecurity({
        ssid: 'OfficeNet',
        authentication,
        cipher
      })

      expect(assessment.status).toBe(expectedStatus)
      expect(assessment.reason).toBe(expectedReason)
    }
  )
})

describe('parseWindowsActiveWifiFacts', () => {
  it('parses the netsh JSON projection', () => {
    expect(
      parseWindowsActiveWifiFacts(
        '{"SSID":"OfficeNet","Authentication":"WPA2-Personal","Cipher":"CCMP"}'
      )
    ).toEqual({
      ssid: 'OfficeNet',
      authentication: 'WPA2-Personal',
      cipher: 'CCMP'
    })
  })
})
