import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcChannels } from '@shared/ipc'
import { registerIpc } from './ipc'

const electronMocks = vi.hoisted(() => ({
  handle: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.handle
  }
}))

vi.mock('./app-controller', () => ({
  AppController: class AppController {}
}))

function createController() {
  return {
    getState: vi.fn(),
    submitEmail: vi.fn(),
    submitCode: vi.fn(),
    rescan: vi.fn(),
    retryCurrentAction: vi.fn(),
    logout: vi.fn(),
    openSupportEmail: vi.fn(),
    openTroubleshooting: vi.fn(),
    openFirewallSettings: vi.fn(),
    openDiskEncryptionSettings: vi.fn(),
    openAppStore: vi.fn(),
    openWifiSettings: vi.fn(),
    openRemoteLoginSettings: vi.fn()
  }
}

function getHandler(channel: string) {
  const registration = electronMocks.handle.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel
  )

  if (!registration) {
    throw new Error(`No handler registered for ${channel}`)
  }

  return registration[1] as (...args: unknown[]) => unknown
}

describe('registerIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all expected IPC channels', () => {
    registerIpc(createController() as never)

    expect(electronMocks.handle.mock.calls.map(([channel]) => channel)).toEqual(
      [
        ipcChannels.getState,
        ipcChannels.submitEmail,
        ipcChannels.submitCode,
        ipcChannels.rescan,
        ipcChannels.retryCurrentAction,
        ipcChannels.logout,
        ipcChannels.openSupportEmail,
        ipcChannels.openTroubleshooting,
        ipcChannels.openFirewallSettings,
        ipcChannels.openDiskEncryptionSettings,
        ipcChannels.openAppStore,
        ipcChannels.openWifiSettings,
        ipcChannels.openRemoteLoginSettings
      ]
    )
  })

  it('routes IPC calls to matching controller methods', async () => {
    const controller = createController()
    registerIpc(controller as never)

    await getHandler(ipcChannels.getState)()
    await getHandler(ipcChannels.submitEmail)(null, {
      email: 'user@example.com'
    })
    await getHandler(ipcChannels.submitCode)(null, { code: '1234' })
    await getHandler(ipcChannels.rescan)()
    await getHandler(ipcChannels.retryCurrentAction)()
    await getHandler(ipcChannels.logout)()
    await getHandler(ipcChannels.openSupportEmail)()
    await getHandler(ipcChannels.openTroubleshooting)()
    await getHandler(ipcChannels.openFirewallSettings)()
    await getHandler(ipcChannels.openDiskEncryptionSettings)()
    await getHandler(ipcChannels.openAppStore)()
    await getHandler(ipcChannels.openWifiSettings)()
    await getHandler(ipcChannels.openRemoteLoginSettings)()

    expect(controller.getState).toHaveBeenCalledOnce()
    expect(controller.submitEmail).toHaveBeenCalledWith('user@example.com')
    expect(controller.submitCode).toHaveBeenCalledWith('1234')
    expect(controller.rescan).toHaveBeenCalledOnce()
    expect(controller.retryCurrentAction).toHaveBeenCalledOnce()
    expect(controller.logout).toHaveBeenCalledOnce()
    expect(controller.openSupportEmail).toHaveBeenCalledOnce()
    expect(controller.openTroubleshooting).toHaveBeenCalledOnce()
    expect(controller.openFirewallSettings).toHaveBeenCalledOnce()
    expect(controller.openDiskEncryptionSettings).toHaveBeenCalledOnce()
    expect(controller.openAppStore).toHaveBeenCalledOnce()
    expect(controller.openWifiSettings).toHaveBeenCalledOnce()
    expect(controller.openRemoteLoginSettings).toHaveBeenCalledOnce()
  })
})
