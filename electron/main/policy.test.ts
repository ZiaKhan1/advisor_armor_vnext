import { describe, expect, it } from 'vitest'
import { parsePolicyResponse } from './policy'

describe('parsePolicyResponse', () => {
  it('normalizes policy response', () => {
    const parsed = parsePolicyResponse(
      {
        AppPolicy: {
          macPolicy: {
            prohibitedApps: [{ AppName: 'ChatGPT' }],
            requiredAppsCategories: [
              {
                apps: [{ AppName: 'Bitdefender' }],
                requiredAppsCount: '1'
              }
            ]
          }
        },
        systemPolicy: {
          Firewall: 'fail',
          DiskEncryption: 'NUDGE',
          AutomaticUpdates: 'PASS',
          RemoteLoginMacNudge: 'FAIL',
          ScreenIdleMac: 600,
          ScreenLockMac: 0,
          ApprovedVersionforMAC: '14.0.0',
          NudgedVersionforMAC: '13.0.0',
          IsShowPIIScan: 'YES',
          ScanIntervalHours: 12,
          ActiveWifiNetwork: 'FAIL',
          KnownWifiNetworks: 'FAIL',
          NetworkIDPolicy: 'FAIL',
          NetworkIDIPs: '1.1.1.1',
          'NW-WPA': 'FAIL',
          'NW-WPA-2': 'FAIL',
          'NW-WPA-3': 'FAIL'
        }
      },
      true
    )

    expect(parsed.firewall).toBe('FAIL')
    expect(parsed.diskEncryption).toBe('NUDGE')
    expect(parsed.scanIntervalHours).toBe(12)
    expect(parsed.appsPolicy.prohibitedApps).toEqual(['ChatGPT'])
  })
})
