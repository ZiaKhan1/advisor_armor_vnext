import { describe, expect, it } from 'vitest'
import {
  parseMacScreenIdleState,
  parseMacScreenLockState,
  parseWindowsScreenLockState,
  parseWindowsScreenIdleState
} from './screen-security'

describe('parseMacScreenIdleState', () => {
  it('maps a positive idleTime to seconds', () => {
    expect(parseMacScreenIdleState('300\n')).toEqual({
      kind: 'seconds',
      seconds: 300
    })
  })

  it('maps idleTime 0 to never', () => {
    expect(parseMacScreenIdleState('0\n')).toEqual({ kind: 'never' })
  })

  it('maps blank output to unknown', () => {
    expect(parseMacScreenIdleState('')).toEqual({ kind: 'unknown' })
  })

  it('maps invalid output to unknown', () => {
    expect(parseMacScreenIdleState('not found\n')).toEqual({
      kind: 'unknown'
    })
    expect(parseMacScreenIdleState('-1\n')).toEqual({ kind: 'unknown' })
    expect(parseMacScreenIdleState('300 seconds\n')).toEqual({
      kind: 'unknown'
    })
  })
})

describe('parseWindowsScreenIdleState', () => {
  it('maps a positive ScreenSaveTimeOut to seconds', () => {
    expect(parseWindowsScreenIdleState('600\n')).toEqual({
      kind: 'seconds',
      seconds: 600
    })
  })

  it('maps inactive screen saver to never', () => {
    expect(parseWindowsScreenIdleState('NEVER\n')).toEqual({ kind: 'never' })
  })

  it('maps ScreenSaveTimeOut 0 to never', () => {
    expect(parseWindowsScreenIdleState('0\n')).toEqual({ kind: 'never' })
  })

  it('maps unknown and blank output to unknown', () => {
    expect(parseWindowsScreenIdleState('UNKNOWN\n')).toEqual({
      kind: 'unknown'
    })
    expect(parseWindowsScreenIdleState('')).toEqual({ kind: 'unknown' })
  })

  it('maps invalid output to unknown', () => {
    expect(parseWindowsScreenIdleState('not found\n')).toEqual({
      kind: 'unknown'
    })
    expect(parseWindowsScreenIdleState('-1\n')).toEqual({ kind: 'unknown' })
    expect(parseWindowsScreenIdleState('600 seconds\n')).toEqual({
      kind: 'unknown'
    })
  })
})

describe('parseMacScreenLockState', () => {
  it('maps disabled password requirement to never', () => {
    expect(parseMacScreenLockState('0\n', '5\n')).toEqual({ kind: 'never' })
  })

  it('maps zero delay to immediately', () => {
    expect(parseMacScreenLockState('1\n', '0\n')).toEqual({
      kind: 'immediately'
    })
  })

  it('maps positive delay to seconds', () => {
    expect(parseMacScreenLockState('1\n', '300\n')).toEqual({
      kind: 'seconds',
      seconds: 300
    })
  })

  it('maps invalid output to unknown', () => {
    expect(parseMacScreenLockState('', '0\n')).toEqual({ kind: 'unknown' })
    expect(parseMacScreenLockState('2\n', '0\n')).toEqual({ kind: 'unknown' })
    expect(parseMacScreenLockState('1\n', '-1\n')).toEqual({
      kind: 'unknown'
    })
    expect(parseMacScreenLockState('1\n', '5 seconds\n')).toEqual({
      kind: 'unknown'
    })
  })
})

describe('parseWindowsScreenLockState', () => {
  it('maps secure values to required', () => {
    expect(parseWindowsScreenLockState('SECURE\n')).toEqual({
      kind: 'required'
    })
    expect(parseWindowsScreenLockState('1\n')).toEqual({ kind: 'required' })
  })

  it('maps not secure values to not required', () => {
    expect(parseWindowsScreenLockState('NOT_SECURE\n')).toEqual({
      kind: 'notRequired'
    })
    expect(parseWindowsScreenLockState('0\n')).toEqual({
      kind: 'notRequired'
    })
  })

  it('maps unknown, blank, and invalid output to unknown', () => {
    expect(parseWindowsScreenLockState('UNKNOWN\n')).toEqual({
      kind: 'unknown'
    })
    expect(parseWindowsScreenLockState('')).toEqual({ kind: 'unknown' })
    expect(parseWindowsScreenLockState('maybe\n')).toEqual({
      kind: 'unknown'
    })
  })
})
