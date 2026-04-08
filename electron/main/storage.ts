import { app } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LastScanMetadata, Settings, UserInfo } from '@shared/models'

const defaultSettings: Settings = {
  scanIntervalHours: 24,
  diagnosticLogLevel: 'detailed'
}

export class Storage {
  private readonly root = app.getPath('userData')
  private readonly storageDir = join(this.root, 'storage')
  private readonly userPath = join(this.storageDir, 'user.json')
  private readonly lastScanPath = join(this.storageDir, 'last-scan.json')
  private readonly settingsPath = join(this.root, 'settings.json')

  async initialize(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true })
  }

  async readUser(): Promise<UserInfo | null> {
    return this.readJson<UserInfo>(this.userPath)
  }

  async writeUser(user: UserInfo): Promise<void> {
    await this.writeJson(this.userPath, user)
  }

  async clearUser(): Promise<void> {
    await rm(this.userPath, { force: true })
  }

  async readSettings(): Promise<Settings> {
    const settings = await this.readJson<Settings>(this.settingsPath)
    return { ...defaultSettings, ...settings }
  }

  async writeSettings(settings: Partial<Settings>): Promise<Settings> {
    const merged = { ...(await this.readSettings()), ...settings }
    await this.writeJson(this.settingsPath, merged)
    return merged
  }

  async readLastScan(): Promise<LastScanMetadata | null> {
    return this.readJson<LastScanMetadata>(this.lastScanPath)
  }

  async writeLastScan(lastScan: LastScanMetadata): Promise<void> {
    await this.writeJson(this.lastScanPath, lastScan)
  }

  async clearLastScan(): Promise<void> {
    await rm(this.lastScanPath, { force: true })
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await readFile(filePath, 'utf8')
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
  }
}
