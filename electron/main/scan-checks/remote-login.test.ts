import { describe, expect, it } from 'vitest'
import {
  parseMacRemoteLoginNetstatState,
  parseWindowsRemoteLoginState
} from './remote-login'

describe('parseMacRemoteLoginNetstatState', () => {
  it('detects listening SSH on all interfaces', () => {
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp4 0 0 *.22 *.* LISTEN 131072 131072 123 0'
      )
    ).toBe(true)
  })

  it('detects listening Telnet on all interfaces', () => {
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp4 0 0 *.23 *.* LISTEN 131072 131072 123 0'
      )
    ).toBe(true)
  })

  it('detects IPv6 SSH listener formats', () => {
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp6 0 0 *.22 *.* LISTEN 131072 131072 123 0'
      )
    ).toBe(true)
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp6 0 0 :::22 :::* LISTEN 131072 131072 123 0'
      )
    ).toBe(true)
  })

  it('returns false when remote login ports are not listening', () => {
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp4 0 0 *.443 *.* LISTEN 131072 131072 123 0'
      )
    ).toBe(false)
  })

  it('ignores non-listening remote login ports', () => {
    expect(
      parseMacRemoteLoginNetstatState(
        'tcp4 0 0 127.0.0.1.51234 127.0.0.1.22 ESTABLISHED 131072 131072 123 0'
      )
    ).toBe(false)
  })

  it('returns null for blank output', () => {
    expect(parseMacRemoteLoginNetstatState('')).toBeNull()
  })
})

describe('parseWindowsRemoteLoginState', () => {
  it('detects enabled Remote Desktop', () => {
    expect(parseWindowsRemoteLoginState('0')).toBe(true)
  })

  it('detects disabled Remote Desktop', () => {
    expect(parseWindowsRemoteLoginState('1')).toBe(false)
  })

  it('returns null for unknown values', () => {
    expect(parseWindowsRemoteLoginState('2')).toBeNull()
    expect(parseWindowsRemoteLoginState('unexpected')).toBeNull()
    expect(parseWindowsRemoteLoginState('')).toBeNull()
  })
})
