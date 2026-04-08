import { app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { logger } from './logging'

const { autoUpdater } = electronUpdater

export class UpdateService {
  private intervalId: NodeJS.Timeout | null = null

  configure(): void {
    autoUpdater.autoDownload = false

    autoUpdater.on('update-available', () => {
      void dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: 'A new version is available, download now?',
          buttons: ['Download', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        .then(result => {
          if (result.response === 0) {
            void autoUpdater.downloadUpdate()
          }
        })
    })

    autoUpdater.on('update-downloaded', () => {
      void dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Downloaded',
          message: 'Update downloaded, app will restart to install.',
          buttons: ['Restart']
        })
        .then(() => {
          autoUpdater.quitAndInstall()
        })
    })

    autoUpdater.on('error', error => {
      logger.error('Auto update error', error)
    })
  }

  start(intervalMs: number): void {
    this.configure()
    void this.checkForUpdates()
    this.intervalId = setInterval(() => {
      void this.checkForUpdates()
    }, intervalMs)
  }

  async checkForUpdates(): Promise<void> {
    if (!app.isPackaged) {
      logger.info('Skipping update check in development mode')
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      logger.error('Update check failed', error)
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.intervalId = null
  }
}
