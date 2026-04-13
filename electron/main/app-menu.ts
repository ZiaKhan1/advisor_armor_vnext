import {
  Menu,
  app,
  clipboard,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { config } from '../../src/config'

export interface AppMenuHandlers {
  checkForUpdates: () => void
  rescan?: () => void
  toggleDeveloperTools: () => void
}

export interface AppMenuOptions {
  includeRescan?: boolean
  handlers: AppMenuHandlers
}

export function createAppContextMenu({
  includeRescan = false,
  handlers
}: AppMenuOptions): Menu {
  const template: MenuItemConstructorOptions[] = []

  if (includeRescan && handlers.rescan) {
    template.push({ label: 'Rescan', click: handlers.rescan })
  }

  template.push(
    { label: 'Check for Update', click: handlers.checkForUpdates },
    { type: 'separator' },
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
        {
          label: `${config.displayName} version ${app.getVersion()}`,
          enabled: false
        },
        { label: 'Copy Debug Info', click: copyDebugInfo }
      ]
    },
    { type: 'separator' },
    {
      label: 'Toggle Developer Tools',
      accelerator: 'Alt+CommandOrControl+I',
      click: handlers.toggleDeveloperTools
    },
    {
      label: `Quit ${config.productName}`,
      accelerator: 'CommandOrControl+Q',
      click: () => app.quit()
    }
  )

  return Menu.buildFromTemplate(template)
}

function copyDebugInfo(): void {
  clipboard.writeText(
    [
      `${config.displayName} version ${app.getVersion()}`,
      `Electron ${process.versions.electron}`,
      `Platform ${process.platform}`,
      `Architecture ${process.arch}`,
      `Packaged ${app.isPackaged ? 'yes' : 'no'}`
    ].join('\n')
  )
}
