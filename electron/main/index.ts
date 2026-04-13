import { app } from 'electron'
import { config } from '../../src/config'
import { AppController } from './app-controller'
import { registerIpc } from './ipc'
import { logger } from './logging'
import { createTray } from './tray'
import { createMainWindow } from './window'

app.setName(config.productName)

const controller = new AppController()

async function bootstrap(): Promise<void> {
  app.setLoginItemSettings({
    openAtLogin: true
  })

  const mainWindow = createMainWindow()
  controller.setWindow(mainWindow)
  registerIpc(controller)

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile('out/renderer/index.html')
  }

  createTray({
    showMainWindow: () => {
      mainWindow.show()
      mainWindow.focus()
    },
    rescan: () => {
      void controller.rescan()
    },
    checkForUpdates: () => {
      void controller.checkForUpdates()
    }
  })

  await controller.initialize()
}

app.whenReady().then(() => {
  void bootstrap()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  logger.info('Application activated')
})
