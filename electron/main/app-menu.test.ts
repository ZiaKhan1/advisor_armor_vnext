import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { createAppContextMenu } from './app-menu'

const electronMocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(
    (template: MenuItemConstructorOptions[]) => template
  ),
  quit: vi.fn(),
  getVersion: vi.fn(() => '4.0.0'),
  writeText: vi.fn(),
  openExternal: vi.fn()
}))

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: electronMocks.buildFromTemplate
  },
  app: {
    getVersion: electronMocks.getVersion,
    isPackaged: false,
    quit: electronMocks.quit
  },
  clipboard: {
    writeText: electronMocks.writeText
  },
  shell: {
    openExternal: electronMocks.openExternal
  }
}))

function createMenuTemplate(
  includeRescan = true
): MenuItemConstructorOptions[] {
  return createAppContextMenu({
    includeRescan,
    handlers: {
      checkForUpdates: vi.fn(),
      rescan: vi.fn(),
      toggleDeveloperTools: vi.fn()
    }
  }) as unknown as MenuItemConstructorOptions[]
}

describe('createAppContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds the shared app menu with expected top-level labels', () => {
    const template = createMenuTemplate()

    expect(template.map((item) => item.label ?? item.type)).toEqual([
      'Rescan',
      'Check for Update',
      'separator',
      'Help',
      'separator',
      'Toggle Developer Tools',
      'Quit Advisor Armor'
    ])
  })

  it('builds the expected Help submenu', () => {
    const template = createMenuTemplate()
    const helpMenu = template.find((item) => item.label === 'Help')

    expect(
      (helpMenu?.submenu as MenuItemConstructorOptions[]).map(
        (item) => item.label
      )
    ).toEqual([
      'Email Support',
      'Troubleshooting',
      'Advisor Armor version 4.0.0',
      'Copy Debug Info'
    ])
  })

  it('does not include removed Copy or Show menu items', () => {
    const template = createMenuTemplate()
    const labels = template.map((item) => item.label)

    expect(labels).not.toContain('Copy')
    expect(labels).not.toContain('Show Advisor Armor')
  })

  it('omits Rescan when the menu is built without it', () => {
    const template = createMenuTemplate(false)

    expect(template.map((item) => item.label)).not.toContain('Rescan')
  })
})
