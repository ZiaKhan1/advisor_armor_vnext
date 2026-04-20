import path from 'node:path'
import type {
  NormalizedPolicy,
  PolicyAppDetection,
  AppDetectionStatus
} from '@shared/models'
import { runCommand } from '../command-runner'

type AppsPolicy = NormalizedPolicy['appsPolicy']

export function splitPathAndAppName(input: string): {
  folderPath: string
  appName: string
} {
  if (typeof input !== 'string' || input.trim() === '') {
    return { folderPath: '', appName: '' }
  }

  const folderPath = path.dirname(input)
  const appName = path.basename(input)

  return {
    folderPath: folderPath === '.' ? '' : folderPath,
    appName
  }
}

export function isParentPath(
  fullFilePath: string,
  folderPath: string
): boolean {
  if (!fullFilePath || !folderPath) {
    return false
  }

  const parentDir = path.dirname(fullFilePath)
  const normalizedFolderPath = path.normalize(folderPath)
  const cleanFolderPath =
    normalizedFolderPath !== path.sep && normalizedFolderPath.endsWith(path.sep)
      ? normalizedFolderPath.slice(0, -1)
      : normalizedFolderPath

  return parentDir.toLowerCase().endsWith(cleanFolderPath.toLowerCase())
}

export function doesAppExistInFolder(
  resultPathsHavingAppName: string,
  folderPath: string
): boolean {
  if (!resultPathsHavingAppName) {
    return false
  }

  if (!folderPath) {
    return true
  }

  return resultPathsHavingAppName.split('\n').some((appPath) => {
    return isParentPath(appPath, folderPath)
  })
}

function escapeSpotlightString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''")
}

async function readMacPolicyAppStatus(
  folderPath: string,
  appName: string
): Promise<AppDetectionStatus> {
  if (!appName) {
    return 'not-installed'
  }

  const query = `kMDItemKind == 'Application' && kMDItemDisplayName == '${escapeSpotlightString(appName)}'c`
  const result = await runCommand('mdfind', [query])

  if (!result.ok) {
    return 'unknown'
  }

  return doesAppExistInFolder(result.stdout, folderPath)
    ? 'installed'
    : 'not-installed'
}

async function readWindowsPolicyAppStatus(
  folderPath: string,
  appName: string
): Promise<AppDetectionStatus> {
  if (folderPath || !appName) {
    return 'not-installed'
  }

  const escapedAppName = escapePowerShellSingleQuotedString(appName)
  const command = `(Get-StartApps | Where-Object {$_.Name -eq '${escapedAppName}'}).Name`
  const result = await runCommand('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    command
  ])

  if (!result.ok) {
    return 'unknown'
  }

  return result.stdout ? 'installed' : 'not-installed'
}

function getUniquePolicyAppNames(appsPolicy: AppsPolicy): string[] {
  const appNames = [
    ...appsPolicy.prohibitedApps,
    ...appsPolicy.requiredAppsCategories.flatMap((category) => category.apps)
  ]
  const unique = new Map<string, string>()

  appNames.forEach((appName) => {
    const key = appName.toLowerCase()
    if (!unique.has(key)) {
      unique.set(key, appName)
    }
  })

  return [...unique.values()]
}

export async function readPolicyAppDetections(
  currentPlatform: string,
  appsPolicy: AppsPolicy
): Promise<PolicyAppDetection[]> {
  const policyAppNames = getUniquePolicyAppNames(appsPolicy)

  return Promise.all(
    policyAppNames.map(async (policyAppName) => {
      const { folderPath, appName } = splitPathAndAppName(policyAppName)
      const status =
        currentPlatform === 'darwin'
          ? await readMacPolicyAppStatus(folderPath, appName)
          : currentPlatform === 'win32'
            ? await readWindowsPolicyAppStatus(folderPath, appName)
            : 'unknown'

      return {
        policyAppName,
        folderPath,
        appName,
        status
      }
    })
  )
}
