import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWindowsDefenderState } from './windows-defender'

const moduleMocks = vi.hoisted(() => ({
  runCommand: vi.fn(),
  logger: {
    warn: vi.fn()
  }
}))

vi.mock('../command-runner', () => ({
  runCommand: moduleMocks.runCommand
}))

vi.mock('../logging', () => ({
  logger: moduleMocks.logger
}))

describe('parseWindowsDefenderState', () => {
  it('passes when DisableRealtimeMonitoring is False', () => {
    expect(parseWindowsDefenderState('False')).toBe(true)
    expect(parseWindowsDefenderState('false')).toBe(true)
  })

  it('fails when DisableRealtimeMonitoring is True', () => {
    expect(parseWindowsDefenderState('True')).toBe(false)
    expect(parseWindowsDefenderState('true')).toBe(false)
  })

  it('handles numeric preference output defensively', () => {
    expect(parseWindowsDefenderState('0')).toBe(true)
    expect(parseWindowsDefenderState('1')).toBe(false)
  })

  it('returns null for unknown output', () => {
    expect(parseWindowsDefenderState('')).toBeNull()
    expect(parseWindowsDefenderState('unexpected output')).toBeNull()
  })
})

describe('readWindowsDefenderEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null on non-Windows platforms', async () => {
    const { readWindowsDefenderEnabled } = await import('./windows-defender')

    await expect(readWindowsDefenderEnabled('darwin')).resolves.toBeNull()
    expect(moduleMocks.runCommand).not.toHaveBeenCalled()
  })

  it('runs the legacy DisableRealtimeMonitoring check on Windows', async () => {
    moduleMocks.runCommand.mockResolvedValue({
      ok: true,
      stdout: 'False',
      stderr: ''
    })

    const { readWindowsDefenderEnabled } = await import('./windows-defender')

    await expect(readWindowsDefenderEnabled('win32')).resolves.toBe(true)
    expect(moduleMocks.runCommand).toHaveBeenCalledWith(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '(Get-MpPreference).DisableRealtimeMonitoring'
      ],
      10_000
    )
  })

  it('returns null when the command fails', async () => {
    moduleMocks.runCommand.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'Get-MpPreference failed'
    })

    const { readWindowsDefenderEnabled } = await import('./windows-defender')

    await expect(readWindowsDefenderEnabled('win32')).resolves.toBeNull()
  })
})
