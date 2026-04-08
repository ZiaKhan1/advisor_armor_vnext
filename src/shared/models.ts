import type { OverallStatus, PolicyStatus } from './status'

export type Screen =
  | 'email'
  | 'code'
  | 'loading'
  | 'results'
  | 'blocking-error'

export type SubmissionPhase = 'idle' | 'submitting' | 'failed' | 'succeeded'

export interface UserInfo {
  email: string
  isAdmin: boolean
  companyName: string
}

export interface LastScanMetadata {
  completedAt: string
  durationMs: number
  overallStatus: OverallStatus
}

export interface Settings {
  scanIntervalHours: number
  diagnosticLogLevel: 'off' | 'minimal' | 'detailed'
}

export interface RequiredAppsCategory {
  apps: string[]
  requiredAppsCount: number
}

export interface NormalizedPolicy {
  osVersions: {
    win: { ok: string; nudge: string }
    winNon10: { ok: string; nudge: string }
    mac: { ok: string; nudge: string }
  }
  screenIdle: { win: number | null; mac: number | null }
  screenLock: { win: number | null; mac: number | null }
  remoteLogin: { win: PolicyStatus; mac: PolicyStatus }
  firewall: PolicyStatus
  diskEncryption: PolicyStatus
  winDefenderAV: PolicyStatus
  activeWifiNetwork: PolicyStatus
  knownWifiNetworks: PolicyStatus
  automaticUpdates: PolicyStatus
  scan: boolean
  isShowPiiScan: boolean
  scanIntervalHours: number
  networkSecurity: {
    wpa: PolicyStatus
    wpa2: PolicyStatus
    wpa3: PolicyStatus
  }
  networkId: PolicyStatus
  networkIdIps: string
  appsPolicy: {
    prohibitedApps: string[]
    requiredAppsCategories: RequiredAppsCategory[]
  }
}

export interface WifiConnection {
  id: string
  iface: string
  model: string
  ssid: string
  bssid: string
  channel: string
  frequency: string
  type: string
  security: string
  signalLevel: string
  txRate: string
  wpaResult: PolicyStatus
  wpa2Result: PolicyStatus
  wpa3Result: PolicyStatus
}

export interface DeviceSnapshot {
  deviceName: string
  platformName: string
  platform: string
  osVersion: string
  hardwareModel: string
  hardwareSerial: string
  deviceId: string
  firewallEnabled: boolean | null
  diskEncryptionEnabled: boolean | null
  automaticUpdatesEnabled: boolean | null
  remoteLoginEnabled: boolean | null
  winDefenderEnabled: boolean | null
  activeWifiSecure: boolean | null
  knownWifiSecure: boolean | null
  networkIdInUse: string
  installedApps: string[]
  wifiConnections: WifiConnection[]
  screenIdleSeconds: number | null
  screenLockSeconds: number | null
}

export type ScanElementKey =
  | 'osVersion'
  | 'firewall'
  | 'diskEncryption'
  | 'screenIdle'
  | 'screenLock'
  | 'automaticUpdates'
  | 'remoteLogin'
  | 'activeWifiNetwork'
  | 'knownWifiNetworks'
  | 'networkId'
  | 'applications'
  | 'winDefenderAV'

export interface ScanElementResult {
  key: ScanElementKey
  title: string
  status: PolicyStatus
  description: string
  detail: string
  fixInstruction: string
}

export interface ScanResultData {
  status: OverallStatus
  osVersion: PolicyStatus
  firewall: PolicyStatus
  diskEncryption: PolicyStatus
  winDefenderAV: PolicyStatus
  screenLock: PolicyStatus
  screenIdle: PolicyStatus
  automaticUpdates: PolicyStatus
  remoteLogin: PolicyStatus
  activeWifiNetwork: PolicyStatus
  knownWifiNetworks: PolicyStatus
  networkID: PolicyStatus
  networkIDInUse: string
  applications: PolicyStatus
  appsPolicyResult: {
    appsScanResult: PolicyStatus
    installedProhibitedApps: string[]
    missingRequiredAppsCategories: string[]
  }
  elements: ScanElementResult[]
}

export interface SubmissionState {
  phase: SubmissionPhase
  attempt: number
  maxAttempts: number
  errorMessage: string | null
}

export interface UpdateState {
  available: boolean
  downloaded: boolean
  message: string | null
}

export interface RendererState {
  screen: Screen
  busy: boolean
  title: string
  message: string | null
  errorMessage: string | null
  pendingEmail: string | null
  user: UserInfo | null
  settings: Settings
  lastScan: LastScanMetadata | null
  currentScan: {
    startedAt: string | null
    durationMs: number | null
    companyName: string | null
    result: ScanResultData | null
  }
  submission: SubmissionState
  update: UpdateState
}
