import type { RendererState } from './models'

export interface SubmitEmailInput {
  email: string
}

export interface SubmitCodeInput {
  code: string
}

export interface DeviceWatchApi {
  getState: () => Promise<RendererState>
  subscribeState: (listener: (state: RendererState) => void) => () => void
  submitEmail: (input: SubmitEmailInput) => Promise<void>
  submitCode: (input: SubmitCodeInput) => Promise<void>
  rescan: () => Promise<void>
  retryCurrentAction: () => Promise<void>
  logout: () => Promise<void>
  openSupportEmail: () => Promise<void>
  openTroubleshooting: () => Promise<void>
  openFirewallSettings: () => Promise<void>
  openDiskEncryptionSettings: () => Promise<void>
  openAppStore: () => Promise<void>
  openRemoteLoginSettings: () => Promise<void>
  openWifiSettings: () => Promise<void>
}

export const ipcChannels = {
  getState: 'app:get-state',
  submitEmail: 'auth:submit-email',
  submitCode: 'auth:submit-code',
  rescan: 'scan:rescan',
  retryCurrentAction: 'scan:retry-current-action',
  logout: 'auth:logout',
  openSupportEmail: 'help:open-support-email',
  openTroubleshooting: 'help:open-troubleshooting',
  openFirewallSettings: 'system:open-firewall-settings',
  openDiskEncryptionSettings: 'system:open-disk-encryption-settings',
  openAppStore: 'system:open-app-store',
  openRemoteLoginSettings: 'system:open-remote-login-settings',
  openWifiSettings: 'system:open-wifi-settings',
  stateChanged: 'app:state-changed'
} as const
