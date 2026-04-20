import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  doesAppExistInFolder,
  isParentPath,
  readPolicyAppDetections,
  splitPathAndAppName
} from './installed-apps'

const commandRunnerMocks = vi.hoisted(() => ({
  runCommand: vi.fn()
}))

vi.mock('../command-runner', () => ({
  runCommand: commandRunnerMocks.runCommand
}))

describe('splitPathAndAppName', () => {
  it('returns empty strings for empty input', () => {
    expect(splitPathAndAppName('')).toEqual({ folderPath: '', appName: '' })
  })

  it('splits folder path and app name', () => {
    expect(splitPathAndAppName('/Applications/Example App')).toEqual({
      folderPath: '/Applications',
      appName: 'Example App'
    })
  })

  it('handles app names without folder paths', () => {
    expect(splitPathAndAppName('Example')).toEqual({
      folderPath: '',
      appName: 'Example'
    })
  })

  it('handles trailing slashes', () => {
    expect(splitPathAndAppName('/Example/')).toEqual({
      folderPath: '/',
      appName: 'Example'
    })
  })
})

describe('macOS app folder matching', () => {
  it('matches the immediate parent path suffix case-insensitively', () => {
    expect(
      isParentPath(
        '/Applications/Bitdefender/AntivirusForMac.app',
        'bitdefender'
      )
    ).toBe(true)
    expect(
      isParentPath(
        '/Applications/Bitdefender/AntivirusForMac.app',
        '/Applications2/Bitdefender'
      )
    ).toBe(false)
  })

  it('checks whether mdfind results contain an app in the requested folder', () => {
    expect(
      doesAppExistInFolder(
        '/Applications/Bitdefender/AntivirusForMac.app\n/Applications/AntivirusForMac.app',
        '/Bitdefender/'
      )
    ).toBe(true)
    expect(
      doesAppExistInFolder('/Applications/AntivirusForMac.app', '/Bitdefender/')
    ).toBe(false)
    expect(doesAppExistInFolder('/Applications/AntivirusForMac.app', '')).toBe(
      true
    )
  })
})

describe('readPolicyAppDetections', () => {
  beforeEach(() => {
    commandRunnerMocks.runCommand.mockReset()
  })

  it('uses mdfind on macOS and marks matching apps as installed', async () => {
    commandRunnerMocks.runCommand.mockResolvedValue({
      ok: true,
      stdout: '/Applications/ChatGPT.app',
      stderr: ''
    })

    await expect(
      readPolicyAppDetections('darwin', {
        prohibitedApps: ['ChatGPT'],
        requiredAppsCategories: []
      })
    ).resolves.toEqual([
      {
        policyAppName: 'ChatGPT',
        folderPath: '',
        appName: 'ChatGPT',
        status: 'installed'
      }
    ])
    expect(commandRunnerMocks.runCommand).toHaveBeenCalledWith('mdfind', [
      "kMDItemKind == 'Application' && kMDItemDisplayName == 'ChatGPT'c"
    ])
  })

  it('marks macOS app checks as unknown when mdfind fails', async () => {
    commandRunnerMocks.runCommand.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'mdfind failed'
    })

    await expect(
      readPolicyAppDetections('darwin', {
        prohibitedApps: ['ChatGPT'],
        requiredAppsCategories: []
      })
    ).resolves.toMatchObject([{ status: 'unknown' }])
  })

  it('uses Get-StartApps on Windows and does not support folder paths', async () => {
    commandRunnerMocks.runCommand.mockResolvedValue({
      ok: true,
      stdout: 'Microsoft Defender',
      stderr: ''
    })

    await expect(
      readPolicyAppDetections('win32', {
        prohibitedApps: ['/folder/ChatGPT', 'Microsoft Defender'],
        requiredAppsCategories: []
      })
    ).resolves.toEqual([
      {
        policyAppName: '/folder/ChatGPT',
        folderPath: '/folder',
        appName: 'ChatGPT',
        status: 'not-installed'
      },
      {
        policyAppName: 'Microsoft Defender',
        folderPath: '',
        appName: 'Microsoft Defender',
        status: 'installed'
      }
    ])
    expect(commandRunnerMocks.runCommand).toHaveBeenCalledTimes(1)
    expect(commandRunnerMocks.runCommand).toHaveBeenCalledWith(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-StartApps | Where-Object {$_.Name -eq 'Microsoft Defender'}).Name"
      ]
    )
  })

  it('marks Windows app checks as unknown when PowerShell fails', async () => {
    commandRunnerMocks.runCommand.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'powershell failed'
    })

    await expect(
      readPolicyAppDetections('win32', {
        prohibitedApps: ['Microsoft Defender'],
        requiredAppsCategories: []
      })
    ).resolves.toMatchObject([{ status: 'unknown' }])
  })
})
