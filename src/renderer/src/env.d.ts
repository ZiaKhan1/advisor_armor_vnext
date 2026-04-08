import type { DeviceWatchApi } from '@shared/ipc'

declare global {
  interface Window {
    deviceWatch: DeviceWatchApi
  }
}

export {}
