import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('readActiveWifiSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unknown and logs facts when the macOS helper is missing', async () => {
    moduleMocks.access.mockRejectedValue(new Error('missing helper'))

    const { readActiveWifiSnapshot } = await import('./active-wifi')
    const snapshot = await readActiveWifiSnapshot('darwin')

    expect(snapshot).toEqual({
      facts: {},
      assessment: {
        status: 'unknown',
        reason: 'unknown',
        securityLabel: 'Unknown',
        detail: 'Current Wi-Fi security could not be determined.'
      }
    })
    expect(moduleMocks.runCommand).not.toHaveBeenCalled()
    expect(moduleMocks.logger.warn).toHaveBeenCalledWith(
      'macOS active Wi-Fi helper is missing'
    )
    expect(moduleMocks.logger.info).toHaveBeenCalledWith(
      'Active Wi-Fi facts',
      expect.objectContaining({
        ssid: null,
        security: null,
        securityRawValue: null,
        classification: 'unknown',
        reason: 'unknown'
      })
    )
  })

  it('returns unknown when the macOS helper emits malformed JSON', async () => {
    moduleMocks.access.mockResolvedValue(undefined)
    moduleMocks.runCommand.mockResolvedValue({
      ok: true,
      stdout: 'not-json',
      stderr: ''
    })

    const { readActiveWifiSnapshot } = await import('./active-wifi')
    const snapshot = await readActiveWifiSnapshot('darwin')

    expect(snapshot.assessment.status).toBe('unknown')
    expect(moduleMocks.logger.warn).toHaveBeenCalledWith(
      'Unable to parse macOS active Wi-Fi helper output',
      expect.objectContaining({
        stdout: 'not-json'
      })
    )
  })

  it('logs Windows facts and classification from netsh output', async () => {
    moduleMocks.runCommand.mockResolvedValue({
      ok: true,
      stdout:
        '{"SSID":"OfficeNet","Authentication":"WPA2-Personal","Cipher":"CCMP"}',
      stderr: ''
    })

    const { readActiveWifiSnapshot } = await import('./active-wifi')
    const snapshot = await readActiveWifiSnapshot('win32')

    expect(snapshot.facts).toEqual({
      ssid: 'OfficeNet',
      authentication: 'WPA2-Personal',
      cipher: 'CCMP'
    })
    expect(snapshot.assessment.status).toBe('secure')
    expect(moduleMocks.logger.info).toHaveBeenCalledWith(
      'Active Wi-Fi facts',
      expect.objectContaining({
        ssid: 'OfficeNet',
        authentication: 'WPA2-Personal',
        cipher: 'CCMP',
        classification: 'secure',
        reason: 'modern-protocol'
      })
    )
  })
})
