import { describe, expect, it } from 'vitest'
import {
  parseMacScreenIdleState,
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
