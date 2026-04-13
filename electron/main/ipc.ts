import { ipcMain } from 'electron'
import {
  ipcChannels,
  type SubmitCodeInput,
  type SubmitEmailInput
} from '@shared/ipc'
import { AppController } from './app-controller'

export function registerIpc(controller: AppController): void {
  ipcMain.handle(ipcChannels.getState, () => controller.getState())
  ipcMain.handle(ipcChannels.submitEmail, (_event, input: SubmitEmailInput) =>
    controller.submitEmail(input.email)
  )
  ipcMain.handle(ipcChannels.submitCode, (_event, input: SubmitCodeInput) =>
    controller.submitCode(input.code)
  )
  ipcMain.handle(ipcChannels.rescan, () => controller.rescan())
  ipcMain.handle(ipcChannels.retryCurrentAction, () =>
    controller.retryCurrentAction()
  )
  ipcMain.handle(ipcChannels.logout, () => controller.logout())
  ipcMain.handle(ipcChannels.openSupportEmail, () =>
    controller.openSupportEmail()
  )
  ipcMain.handle(ipcChannels.openTroubleshooting, () =>
    controller.openTroubleshooting()
  )
  ipcMain.handle(ipcChannels.openFirewallSettings, () =>
    controller.openFirewallSettings()
  )
  ipcMain.handle(ipcChannels.openDiskEncryptionSettings, () =>
    controller.openDiskEncryptionSettings()
  )
}
