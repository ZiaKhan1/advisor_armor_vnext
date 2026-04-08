import { Menu, Tray, app, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { config } from '../../src/config'

export interface TrayHandlers {
  showMainWindow: () => void
  rescan: () => void
  checkForUpdates: () => void
}

export function createTray(handlers: TrayHandlers): Tray {
  const image = nativeImage.createFromPath(join(process.cwd(), 'assets', 'tray-icon.png'))
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)

  const menu = Menu.buildFromTemplate([
    { label: 'Show AdvisorArmor', click: handlers.showMainWindow },
    { type: 'separator' },
    { label: 'Rescan', click: handlers.rescan },
    { label: 'Check for Update', click: handlers.checkForUpdates },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Email Support',
          click: () => {
            void shell.openExternal(`mailto:${config.supportEmail}`)
          }
        },
        {
          label: 'Troubleshooting',
          click: () => {
            void shell.openExternal(config.troubleshootingUrl)
          }
        },
        { label: 'App version 0.1.0', enabled: false },
        { label: 'Copy Debug Info', enabled: false }
      ]
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setToolTip(config.productName)
  tray.setContextMenu(menu)
  tray.on('click', handlers.showMainWindow)
  return tray
}
