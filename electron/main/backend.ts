import { config } from '../../src/config'
import type {
  DeviceSnapshot,
  NormalizedPolicy,
  ScanResultData
} from '@shared/models'
import { BackendError } from './backend-errors'
import { logger } from './logging'
import { waitForInternet } from './network'
import { parsePolicyResponse } from './policy'

const CHECK_ACCESS = 'CHECK_ACCESS'
const CHECK_CODE = 'CHECK_CODE'
const POLICY = 'POLICY'
const APP_VERSION = '0.1.0'

export interface BackendApi {
  validateEmail(email: string): Promise<boolean>
  checkAccess(email: string): Promise<{ admin: boolean; companyName: string }>
  validateCode(email: string, code: string): Promise<boolean>
  fetchPolicy(
    email: string,
    isMacOS: boolean
  ): Promise<{ raw: unknown; parsed: NormalizedPolicy }>
  sendScanResult(
    device: DeviceSnapshot,
    result: ScanResultData,
    email: string,
    parsedUserPolicy: NormalizedPolicy
  ): Promise<void>
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  return formData
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BackendError('timeout', `Request timed out for ${input}`, {
        retryable: true
      })
    }
    throw new BackendError('network', `Network error for ${input}`, {
      details: error,
      retryable: true
    })
  } finally {
    clearTimeout(timer)
  }
}

function toBackendError(response: Response, context: string): BackendError {
  return new BackendError(
    'http',
    `${context} failed with HTTP ${response.status}`,
    {
      statusCode: response.status,
      retryable: response.status >= 500
    }
  )
}

function createRealBackend(): BackendApi {
  return {
    async validateEmail(email) {
      const online = await waitForInternet()
      if (!online) {
        throw new BackendError(
          'network',
          'No internet connection before validateEmail',
          {
            retryable: true
          }
        )
      }

      const response = await fetchWithTimeout(
        config.backend.validateEmailUrl,
        {
          method: 'POST',
          body: buildFormData({
            email,
            advisorArmorVersion: APP_VERSION
          })
        },
        config.timeoutsMs.validateEmail
      )

      if (!response.ok) {
        const text = await response.text()
        logger.error('Validate email HTTP error', {
          email,
          body: text,
          status: response.status
        })
        throw toBackendError(response, 'Validate email')
      }

      const result = (await response.json()) as { status?: boolean }
      return result.status === true
    },

    async checkAccess(email) {
      const response = await fetchWithTimeout(
        config.backend.checkAccessUrl,
        {
          method: 'POST',
          body: buildFormData({
            type: CHECK_ACCESS,
            email,
            advisorArmorVersion: APP_VERSION
          })
        },
        config.timeoutsMs.checkAccess
      )

      if (!response.ok) {
        const body = await response.text()
        logger.error('Check access HTTP error', {
          email,
          body,
          status: response.status
        })
        throw toBackendError(response, 'Check access')
      }

      return (await response.json()) as { admin: boolean; companyName: string }
    },

    async validateCode(email, code) {
      const response = await fetchWithTimeout(
        config.backend.validateCodeUrl,
        {
          method: 'POST',
          body: buildFormData({
            type: CHECK_CODE,
            email,
            code,
            advisorArmorVersion: APP_VERSION
          })
        },
        config.timeoutsMs.validateCode
      )

      if (!response.ok) {
        const body = await response.text()
        logger.error('Validate code HTTP error', {
          email,
          code,
          body,
          status: response.status
        })
        throw toBackendError(response, 'Validate code')
      }

      try {
        const result = (await response.json()) as { valid?: boolean }
        return result.valid === true
      } catch (error) {
        logger.error('Validate code parse error', { email, code, error })
        throw new BackendError(
          'unknown',
          'Validate code response parsing failed',
          {
            details: error
          }
        )
      }
    },

    async fetchPolicy(email, isMacOS) {
      const response = await fetchWithTimeout(
        config.backend.policyUrl,
        {
          method: 'POST',
          body: buildFormData({
            type: POLICY,
            email,
            advisorArmorVersion: APP_VERSION
          })
        },
        config.timeoutsMs.policy
      )

      if (!response.ok) {
        const body = await response.text()
        logger.error('Policy HTTP error', {
          email,
          body,
          status: response.status
        })
        throw toBackendError(response, 'Policy fetch')
      }

      const raw = (await response.json()) as Record<string, unknown>
      logger.info('Policy fetch success', raw)

      if (raw.status === 'error') {
        logger.error('Policy application-level error', { email, raw })
        throw new BackendError(
          'application',
          'Policy response returned status=error',
          {
            details: raw,
            retryable: false
          }
        )
      }

      return {
        raw,
        parsed: parsePolicyResponse(raw, isMacOS)
      }
    },

    async sendScanResult(device, result, email, parsedUserPolicy) {
      const response = await fetchWithTimeout(
        config.backend.sendScanResultUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(
            getScanResultPayload(device, result, email, parsedUserPolicy)
          )
        },
        config.timeoutsMs.sendScanResult
      )

      const body = await response.text()
      if (!response.ok) {
        logger.error('Send scan result HTTP error', {
          email,
          body,
          status: response.status
        })
        throw toBackendError(response, 'Send scan result')
      }

      logger.info('Scan result submission completed')
      void body
    }
  }
}

function createMockBackend(): BackendApi {
  const fixedPolicy = {
    AppPolicy: {
      companyName: 'Demo Company',
      macPolicy: {
        prohibitedApps: [{ AppName: 'ChatGPT2' }, { AppName: 'AdvisorArmor2' }],
        requiredAppsCategories: [
          {
            apps: [{ AppName: 'Bitdefender' }, { AppName: 'Avast Security' }],
            requiredAppsCount: '1'
          },
          {
            apps: [{ AppName: 'AdvisorArmor2' }],
            requiredAppsCount: '1'
          }
        ]
      },
      windowsPolicy: {
        prohibitedApps: [{ AppName: 'ChatGPT' }],
        requiredAppsCategories: [
          {
            apps: [{ AppName: 'Microsoft Defender' }, { AppName: '1Password' }],
            requiredAppsCount: '1'
          },
          {
            apps: [{ AppName: 'AdvisorArmor2' }],
            requiredAppsCount: '1'
          }
        ]
      }
    },
    systemPolicy: {
      ApprovedVersionforWindows10: '10.0.19045',
      NudgedVersionforWindows10: '10.0.19044',
      ApprovedVersionforMAC: '14.0.0',
      NudgedVersionforMAC: '13.0.0',
      ScreenIdleWindows: 600,
      ScreenIdleMac: 600,
      ScreenLockWindows: 1,
      ScreenLockMac: 3600,
      NetworkIDPolicy: 'FAIL',
      NetworkIDIPs: '124.150.84.195',
      RemoteLoginWindowsNudge: 'FAIL',
      RemoteLoginMacNudge: 'FAIL',
      ScanPage: 'YES',
      Firewall: 'FAIL',
      DiskEncryption: 'FAIL',
      WinDefenderAV: 'FAIL',
      AutomaticUpdates: 'FAIL',
      IsShowPIIScan: 'NO',
      ScanIntervalHours: 24,
      ActiveWifiNetwork: 'FAIL',
      KnownWifiNetworks: 'FAIL',
      'NW-WPA': 'FAIL',
      'NW-WPA-2': 'FAIL',
      'NW-WPA-3': 'FAIL',
      'ApprovedVersionforWindowsNon-10.': '10.0.19045',
      'NudgedVersionforWindowsnon-10.': '10.0.19044'
    }
  }

  return {
    async validateEmail() {
      return true
    },
    async checkAccess() {
      return { admin: false, companyName: 'Demo Company' }
    },
    async validateCode(_email, code) {
      return code === config.mockOtpCode
    },
    async fetchPolicy(_email, isMacOS) {
      return {
        raw: fixedPolicy,
        parsed: parsePolicyResponse(fixedPolicy, isMacOS)
      }
    },
    async sendScanResult() {
      return
    }
  }
}

export function createBackend(): BackendApi {
  if (config.useMockBackend) {
    logger.info('Using mock backend')
    return createMockBackend()
  }
  logger.info('Using real backend')
  return createRealBackend()
}

function getScanResultPayload(
  device: DeviceSnapshot,
  result: ScanResultData,
  email: string,
  parsedUserPolicy: NormalizedPolicy
): Record<string, unknown> {
  const firstWifiConnection = device.wifiConnections[0] ?? {
    id: 'NA',
    iface: 'NA',
    model: 'NA',
    ssid: 'NA',
    bssid: 'NA',
    channel: 'NA',
    frequency: 'NA',
    type: 'NA',
    security: 'NA',
    signalLevel: 'NA',
    txRate: 'NA',
    wpaResult: 'PASS',
    wpa2Result: 'PASS',
    wpa3Result: 'PASS'
  }

  const systemPolicyResult = {
    Email: getDefaultValue(email),
    version: APP_VERSION,
    appletVersion: APP_VERSION,
    deviceName: getDefaultValue(device.deviceName),
    osVersion: getDefaultValue(device.osVersion),
    hardwareModel: getDefaultValue(device.hardwareModel),
    scanOverallResult: getDefaultResult(result.status),
    osVersionResult: getDefaultResult(result.osVersion),
    firewallResult: getDefaultResult(result.firewall),
    diskEncryptionResult: getDefaultResult(result.diskEncryption),
    winDefenderAVResult: getDefaultResult(result.winDefenderAV),
    screenLockResult: getDefaultResult(result.screenLock),
    screenIdleResult: getDefaultResult(result.screenIdle),
    automaticUpdatesResult: getDefaultResult(result.automaticUpdates),
    remoteLoginResult: getDefaultResult(result.remoteLogin),
    openWifiConnectionsResult: getDefaultResult(undefined),
    activeWifiNetworkResult: getDefaultResult(result.activeWifiNetwork),
    knownWifiNetworksResult: getDefaultResult(result.knownWifiNetworks),
    applicationsResult: getDefaultResult(result.applications),
    manufacturer: getDefaultValue(device.platformName),
    osPlatform: getDefaultValue(device.platform),
    hardwareSerialNo: getDefaultValue(device.hardwareSerial),
    hardwareUUID: getDefaultValue(device.deviceId),
    wifiWPA: getDefaultResult(firstWifiConnection.wpaResult),
    wifiWPA2: getDefaultResult(firstWifiConnection.wpa2Result),
    wifiWPA3: getDefaultResult(firstWifiConnection.wpa3Result),
    wifiID: getDefaultValue(firstWifiConnection.id),
    wifiIFace: getDefaultValue(firstWifiConnection.iface),
    wifiModel: getDefaultValue(firstWifiConnection.model),
    wifiSSID: getDefaultValue(firstWifiConnection.ssid),
    wifiBSSID: getDefaultValue(firstWifiConnection.bssid),
    wifiChannel: getDefaultValue(firstWifiConnection.channel),
    wifiFrequency: getDefaultValue(firstWifiConnection.frequency),
    wifiType: getDefaultValue(firstWifiConnection.type),
    wifiSecurity: getDefaultValue(firstWifiConnection.security),
    wifiSignalLevel: getDefaultValue(firstWifiConnection.signalLevel),
    wifiTxRate: getDefaultValue(firstWifiConnection.txRate),
    networkIdResult: getDefaultResult(result.networkID),
    networkIDIPs: getDefaultValue(parsedUserPolicy.networkIdIps),
    networkIDIPInUse: getDefaultValue(result.networkIDInUse)
  }

  const appPolicyResult = {
    appsScanResult: result.appsPolicyResult.appsScanResult,
    installedProhibitedApps: result.appsPolicyResult.installedProhibitedApps,
    missingRequiredAppsCategories:
      result.appsPolicyResult.missingRequiredAppsCategories
  }

  return {
    SystemPolicyResult: systemPolicyResult,
    AppPolicyResult: appPolicyResult
  }
}

function getDefaultResult(value: string | undefined): string {
  return value ?? 'PASS'
}

function getDefaultValue(value: string | undefined): string {
  return value ?? 'NA'
}
