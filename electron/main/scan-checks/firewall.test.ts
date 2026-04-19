import { describe, expect, it } from 'vitest'
import { parseMacFirewallState, parseWindowsFirewallState } from './firewall'

describe('parseMacFirewallState', () => {
  it('detects enabled firewall output', () => {
    expect(parseMacFirewallState('Firewall is enabled. (State = 1)')).toBe(true)
    expect(parseMacFirewallState('Firewall is on')).toBe(true)
  })

  it('detects disabled firewall output', () => {
    expect(parseMacFirewallState('Firewall is disabled. (State = 0)')).toBe(
      false
    )
    expect(parseMacFirewallState('Firewall is off')).toBe(false)
  })

  it('returns null for unknown output', () => {
    expect(parseMacFirewallState('unexpected output')).toBeNull()
  })
})

describe('parseWindowsFirewallState', () => {
  it('detects enabled firewall profiles from JSON', () => {
    expect(
      parseWindowsFirewallState(
        '[{"Name":"Domain","Enabled":true},{"Name":"Private","Enabled":true},{"Name":"Public","Enabled":true}]'
      )
    ).toBe(true)
  })

  it('detects disabled firewall profiles from JSON', () => {
    expect(
      parseWindowsFirewallState(
        '[{"Name":"Domain","Enabled":true},{"Name":"Private","Enabled":false},{"Name":"Public","Enabled":true}]'
      )
    ).toBe(false)
  })

  it('detects enabled firewall profiles from numeric JSON', () => {
    expect(
      parseWindowsFirewallState(
        '[{"Name":"Domain","Enabled":1},{"Name":"Private","Enabled":1},{"Name":"Public","Enabled":1}]'
      )
    ).toBe(true)
  })

  it('detects disabled firewall profiles from numeric JSON', () => {
    expect(
      parseWindowsFirewallState(
        '[{"Name":"Domain","Enabled":1},{"Name":"Private","Enabled":0},{"Name":"Public","Enabled":1}]'
      )
    ).toBe(false)
  })

  it('detects a single enabled profile from JSON', () => {
    expect(parseWindowsFirewallState('{"Name":"Public","Enabled":true}')).toBe(
      true
    )
  })

  it('falls back to PowerShell text output', () => {
    expect(
      parseWindowsFirewallState(`
Name    : Domain
Enabled : True

Name    : Public
Enabled : False
`)
    ).toBe(false)
  })

  it('returns null for unknown output', () => {
    expect(parseWindowsFirewallState('unexpected output')).toBeNull()
  })
})
