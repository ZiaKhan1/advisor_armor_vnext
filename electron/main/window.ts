import { BrowserWindow, app, shell } from 'electron'
import { join } from 'node:path'
import { config } from '../../src/config'
import { createAppContextMenu } from './app-menu'
import { logger } from './logging'

export interface MainWindowHandlers {
  checkForUpdates: () => void
  rescan: () => void
}

export function createMainWindow(handlers: MainWindowHandlers): BrowserWindow {
  const appTitle = `${config.displayName} (v${app.getVersion()})`
  const window = new BrowserWindow({
    title: appTitle,
    width: 1180,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription) => {
      logger.error('Main window failed to load', {
        errorCode,
        errorDescription
      })
    }
  )

  window.webContents.on('did-finish-load', () => {
    window.setTitle(appTitle)
    logger.info('Main window finished load')
  })

  window.webContents.on(
    'console-message',
    ({ level, message, lineNumber, sourceId }) => {
      logger.info('Renderer console message', {
        level,
        message,
        lineNumber,
        sourceId
      })
    }
  )

  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Renderer process gone', details)
  })

  window.webContents.on('context-menu', () => {
    createAppContextMenu({
      includeRescan: true,
      handlers: {
        rescan: handlers.rescan,
        checkForUpdates: handlers.checkForUpdates,
        toggleDeveloperTools: () => {
          window.webContents.toggleDevTools()
        }
      }
    }).popup({ window })
  })

  return window
}
