import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels, type DeviceWatchApi } from '@shared/ipc'
import type { RendererState } from '@shared/models'

const api: DeviceWatchApi = {
  getState: () => ipcRenderer.invoke(ipcChannels.getState),
  subscribeState: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      state: RendererState
    ) => {
      listener(state)
    }
    ipcRenderer.on(ipcChannels.stateChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(ipcChannels.stateChanged, wrapped)
    }
  },
  submitEmail: (input) => ipcRenderer.invoke(ipcChannels.submitEmail, input),
  submitCode: (input) => ipcRenderer.invoke(ipcChannels.submitCode, input),
  rescan: () => ipcRenderer.invoke(ipcChannels.rescan),
  retryCurrentAction: () => ipcRenderer.invoke(ipcChannels.retryCurrentAction),
  logout: () => ipcRenderer.invoke(ipcChannels.logout),
  openSupportEmail: () => ipcRenderer.invoke(ipcChannels.openSupportEmail),
  openTroubleshooting: () =>
    ipcRenderer.invoke(ipcChannels.openTroubleshooting),
  openFirewallSettings: () =>
    ipcRenderer.invoke(ipcChannels.openFirewallSettings),
  openDiskEncryptionSettings: () =>
    ipcRenderer.invoke(ipcChannels.openDiskEncryptionSettings)
}

contextBridge.exposeInMainWorld('deviceWatch', api)
