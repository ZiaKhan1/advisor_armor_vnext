import { Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { config } from '../../src/config'
import { createAppContextMenu } from './app-menu'
import { logger } from './logging'

export interface TrayHandlers {
  showMainWindow: () => void
  rescan: () => void
  checkForUpdates: () => void
  toggleDeveloperTools: () => void
}

export function createTray(handlers: TrayHandlers): Tray {
  const iconPath = join(__dirname, '../../assets/tray-icon.png')
  const image = nativeImage.createFromPath(iconPath)

  if (image.isEmpty()) {
    logger.warn('Tray icon failed to load', { iconPath })
  }

  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)

  tray.setToolTip(config.productName)
  tray.setContextMenu(
    createAppContextMenu({
      includeRescan: true,
      handlers: {
        rescan: handlers.rescan,
        checkForUpdates: handlers.checkForUpdates,
        toggleDeveloperTools: handlers.toggleDeveloperTools
      }
    })
  )
  tray.on('click', handlers.showMainWindow)
  return tray
}
