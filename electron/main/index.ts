import { app, type BrowserWindow } from 'electron'
import { config } from '../../src/config'
import { AppController } from './app-controller'
import { registerIpc } from './ipc'
import { logger } from './logging'
import { createTray } from './tray'
import { createMainWindow } from './window'

app.setName(config.productName)

const hasSingleInstanceLock = app.requestSingleInstanceLock()
const controller = new AppController()
const duplicateInstanceMessage =
  'Another AdvisorArmor instance is already running; exiting duplicate process.'
let mainWindow: BrowserWindow | null = null

function showMainWindow(): void {
  if (!mainWindow) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

async function bootstrap(): Promise<void> {
  app.setLoginItemSettings({
    openAtLogin: true
  })

  mainWindow = createMainWindow()
  controller.setWindow(mainWindow)
  registerIpc(controller)

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile('out/renderer/index.html')
  }

  createTray({
    showMainWindow,
    rescan: () => {
      void controller.rescan()
    },
    checkForUpdates: () => {
      void controller.checkForUpdates()
    }
  })

  await controller.initialize()
}

if (!hasSingleInstanceLock) {
  logger.info(duplicateInstanceMessage, { pid: process.pid })
  app.quit()
} else {
  app.on('second-instance', () => {
    logger.info('Second application instance requested; focusing existing window')
    showMainWindow()
  })

  app.whenReady().then(() => {
    void bootstrap()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  logger.info('Application activated')
})
