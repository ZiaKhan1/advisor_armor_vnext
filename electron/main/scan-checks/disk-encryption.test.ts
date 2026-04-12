import { describe, expect, it } from 'vitest'
import {
  isDiskEncryptionOk,
  parseMacDiskEncryptionState,
  parseWindowsDiskEncryptionState
} from './disk-encryption'

describe('parseMacDiskEncryptionState', () => {
  it('detects enabled FileVault output', () => {
    expect(parseMacDiskEncryptionState('FileVault is On.')).toBe('enabled')
  })

  it('detects disabled FileVault output', () => {
    expect(parseMacDiskEncryptionState('FileVault is Off.')).toBe('disabled')
  })

  it('detects FileVault encryption in progress', () => {
    expect(
      parseMacDiskEncryptionState('Encryption in progress: Percent completed = 42')
    ).toBe('encrypting')
  })

  it('detects FileVault decryption in progress', () => {
    expect(
      parseMacDiskEncryptionState('Decryption in progress: Percent completed = 42')
    ).toBe('decrypting')
  })

  it('returns unknown for unexpected output', () => {
    expect(parseMacDiskEncryptionState('unexpected output')).toBe('unknown')
  })
})

describe('parseWindowsDiskEncryptionState', () => {
  it('detects enabled BitLocker Shell property values', () => {
    expect(parseWindowsDiskEncryptionState('1')).toBe('enabled')
    expect(parseWindowsDiskEncryptionState('3')).toBe('enabled')
  })

  it('detects suspended BitLocker Shell property value', () => {
    expect(parseWindowsDiskEncryptionState('5')).toBe('suspended')
  })

  it('detects disabled BitLocker Shell property values', () => {
    expect(parseWindowsDiskEncryptionState('0')).toBe('disabled')
    expect(parseWindowsDiskEncryptionState('2')).toBe('disabled')
    expect(parseWindowsDiskEncryptionState('4')).toBe('disabled')
  })

  it('returns unknown for blank, unknown, or non-numeric output', () => {
    expect(parseWindowsDiskEncryptionState('')).toBe('unknown')
    expect(parseWindowsDiskEncryptionState('UNKNOWN')).toBe('unknown')
    expect(parseWindowsDiskEncryptionState('unexpected output')).toBe('unknown')
  })
})

describe('isDiskEncryptionOk', () => {
  it('collapses disk encryption states for policy evaluation', () => {
    expect(isDiskEncryptionOk('enabled')).toBe(true)
    expect(isDiskEncryptionOk('encrypting')).toBe(true)
    expect(isDiskEncryptionOk('disabled')).toBe(false)
    expect(isDiskEncryptionOk('decrypting')).toBe(false)
    expect(isDiskEncryptionOk('suspended')).toBe(false)
    expect(isDiskEncryptionOk('unknown')).toBeNull()
  })
})
