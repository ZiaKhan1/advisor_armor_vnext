import { describe, expect, it } from 'vitest'
import {
  compareSemanticVersion,
  evaluateAutomaticUpdateChecks,
  isMojaveOrLater,
  isTahoeOrLater,
  parseMacPreferenceBoolean,
  parseWindowsPauseUpdatesExpiryTime
} from './automatic-updates'

describe('parseMacPreferenceBoolean', () => {
  it('detects enabled boolean-like values', () => {
    expect(parseMacPreferenceBoolean('1')).toBe(true)
    expect(parseMacPreferenceBoolean('true')).toBe(true)
    expect(parseMacPreferenceBoolean('YES')).toBe(true)
    expect(parseMacPreferenceBoolean('on')).toBe(true)
  })

  it('detects disabled boolean-like values', () => {
    expect(parseMacPreferenceBoolean('0')).toBe(false)
    expect(parseMacPreferenceBoolean('false')).toBe(false)
    expect(parseMacPreferenceBoolean('NO')).toBe(false)
    expect(parseMacPreferenceBoolean('off')).toBe(false)
  })

  it('returns null for unknown values', () => {
    expect(parseMacPreferenceBoolean('unexpected')).toBeNull()
    expect(parseMacPreferenceBoolean('')).toBeNull()
  })
})

describe('evaluateAutomaticUpdateChecks', () => {
  it('passes when all checks are enabled', () => {
    expect(
      evaluateAutomaticUpdateChecks([
        { key: 'one', label: 'One', enabled: true },
        { key: 'two', label: 'Two', enabled: true }
      ])
    ).toBe(true)
  })

  it('fails when any check is disabled', () => {
    expect(
      evaluateAutomaticUpdateChecks([
        { key: 'one', label: 'One', enabled: true },
        { key: 'two', label: 'Two', enabled: false },
        { key: 'three', label: 'Three', enabled: null }
      ])
    ).toBe(false)
  })

  it('returns null when nothing failed but at least one check is unknown', () => {
    expect(
      evaluateAutomaticUpdateChecks([
        { key: 'one', label: 'One', enabled: true },
        { key: 'two', label: 'Two', enabled: null }
      ])
    ).toBeNull()
  })
})

describe('compareSemanticVersion', () => {
  it('compares semantic versions by numeric parts', () => {
    expect(compareSemanticVersion('26.0.2', '26.0.1')).toBe(1)
    expect(compareSemanticVersion('26.0.1', '26.0.1')).toBe(0)
    expect(compareSemanticVersion('14.7', '26.0.1')).toBe(-1)
  })
})

describe('macOS version helpers', () => {
  it('detects Mojave or later', () => {
    expect(isMojaveOrLater('10.14')).toBe(true)
    expect(isMojaveOrLater('10.13.6')).toBe(false)
  })

  it('detects Tahoe or later from 26.0.1', () => {
    expect(isTahoeOrLater('26.0.1')).toBe(true)
    expect(isTahoeOrLater('26.0.2')).toBe(true)
    expect(isTahoeOrLater('26.0.0')).toBe(false)
  })
})

describe('parseWindowsPauseUpdatesExpiryTime', () => {
  const now = new Date('2026-04-13T00:00:00.000Z')

  it('passes when no pause expiry is set', () => {
    expect(parseWindowsPauseUpdatesExpiryTime('', now)).toBe(true)
  })

  it('passes when the pause expiry is in the past', () => {
    expect(
      parseWindowsPauseUpdatesExpiryTime('2026-04-12T00:00:00.000Z', now)
    ).toBe(true)
  })

  it('fails when the pause expiry is in the future', () => {
    expect(
      parseWindowsPauseUpdatesExpiryTime('2026-04-14T00:00:00.000Z', now)
    ).toBe(false)
  })

  it('returns null for invalid dates', () => {
    expect(parseWindowsPauseUpdatesExpiryTime('not a date', now)).toBeNull()
  })
})
