import { BrowserWindow, Menu, app, shell } from 'electron'
import { join } from 'node:path'

export function createMainWindow(): BrowserWindow {
  const isDevelopment = !app.isPackaged
  const window = new BrowserWindow({
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
      devTools: isDevelopment
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Main window failed to load', { errorCode, errorDescription })
  })

  window.webContents.on('did-finish-load', () => {
    console.info('Main window finished load')
  })

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.info('Renderer console message', { level, message, line, sourceId })
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone', details)
  })

  if (isDevelopment) {
    window.webContents.on('context-menu', () => {
      Menu.buildFromTemplate([
        {
          label: 'Toggle Developer Tools',
          click: () => {
            window.webContents.toggleDevTools()
          }
        }
      ]).popup({ window })
    })
  }

  return window
}
