import { platform } from 'node:os'
import type { DiskEncryptionState } from '@shared/models'
import { runCommand } from '../command-runner'
import { logger } from '../logging'

const DISK_ENCRYPTION_COMMAND_TIMEOUT_MS = 10_000

export async function readDiskEncryptionState(
  currentPlatform = platform()
): Promise<DiskEncryptionState> {
  if (currentPlatform === 'darwin') {
    return readMacDiskEncryptionState()
  }

  if (currentPlatform === 'win32') {
    return readWindowsDiskEncryptionState()
  }

  return 'unknown'
}

export function isDiskEncryptionOk(state: DiskEncryptionState): boolean | null {
  if (state === 'enabled' || state === 'encrypting') {
    return true
  }

  if (state === 'disabled' || state === 'decrypting' || state === 'suspended') {
    return false
  }

  return null
}

export function parseMacDiskEncryptionState(
  output: string
): DiskEncryptionState {
  const normalized = output.toLowerCase()

  if (normalized.includes('decryption in progress')) {
    return 'decrypting'
  }

  if (normalized.includes('encryption in progress')) {
    return 'encrypting'
  }

  if (normalized.includes('filevault is off')) {
    return 'disabled'
  }

  if (normalized.includes('filevault is on')) {
    return 'enabled'
  }

  return 'unknown'
}

export function parseWindowsDiskEncryptionState(
  output: string
): DiskEncryptionState {
  const trimmed = output.trim()

  if (!trimmed || /^unknown$/i.test(trimmed)) {
    return 'unknown'
  }

  const value = Number.parseInt(trimmed, 10)
  if (Number.isNaN(value)) {
    return 'unknown'
  }

  if (value === 5) {
    return 'suspended'
  }

  return [1, 3].includes(value) ? 'enabled' : 'disabled'
}

async function readMacDiskEncryptionState(): Promise<DiskEncryptionState> {
  const result = await runCommand(
    'fdesetup',
    ['status'],
    DISK_ENCRYPTION_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return 'unknown'
  }

  const state = parseMacDiskEncryptionState(result.stdout)
  if (state === 'unknown') {
    logger.warn('Unable to parse macOS disk encryption state', {
      stdout: result.stdout
    })
  }

  return state
}

async function readWindowsDiskEncryptionState(): Promise<DiskEncryptionState> {
  const script = `
$shell = New-Object -ComObject Shell.Application
$systemDrive = $env:SystemDrive
$drive = $shell.Namespace(17).ParseName($systemDrive)
if ($null -eq $drive) {
  Write-Output "UNKNOWN"
  exit 0
}
$value = $drive.ExtendedProperty("System.Volume.BitLockerProtection")
Write-Output $value
`

  const result = await runCommand(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ],
    DISK_ENCRYPTION_COMMAND_TIMEOUT_MS
  )

  if (!result.ok) {
    return 'unknown'
  }

  const state = parseWindowsDiskEncryptionState(result.stdout)
  if (state === 'unknown') {
    logger.warn('Unable to parse Windows disk encryption state', {
      stdout: result.stdout
    })
  }

  return state
}
