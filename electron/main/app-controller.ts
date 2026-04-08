import { BrowserWindow, shell } from 'electron'
import { EventEmitter } from 'node:events'
import { config } from '../../src/config'
import type { LastScanMetadata, NormalizedPolicy, RendererState, ScanResultData, UserInfo } from '@shared/models'
import { createBackend, type BackendApi } from './backend'
import { isBackendError } from './backend-errors'
import { logger } from './logging'
import { evaluateDevice, readDeviceSnapshot } from './scan'
import { Storage } from './storage'
import { UpdateService } from './update-service'

export class AppController extends EventEmitter {
  private readonly storage = new Storage()
  private readonly backend: BackendApi = createBackend()
  private readonly updateService = new UpdateService()
  private window: BrowserWindow | null = null
  private scanTimer: NodeJS.Timeout | null = null
  private currentPolicy: NormalizedPolicy | null = null
  private pendingAccessContext: { email: string; companyName: string; isAdmin: boolean } | null = null
  private state: RendererState = {
    screen: 'loading',
    busy: true,
    title: 'Starting AdvisorArmor',
    message: 'Loading application...',
    errorMessage: null,
    pendingEmail: null,
    user: null,
    settings: {
      scanIntervalHours: 24,
      diagnosticLogLevel: 'detailed'
    },
    lastScan: null,
    currentScan: {
      startedAt: null,
      durationMs: null,
      companyName: null,
      result: null
    },
    submission: {
      phase: 'idle',
      attempt: 0,
      maxAttempts: config.submission.maxAttempts,
      errorMessage: null
    },
    update: {
      available: false,
      downloaded: false,
      message: null
    }
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  async initialize(): Promise<void> {
    await this.storage.initialize()
    this.state.settings = await this.storage.readSettings()
    this.state.lastScan = await this.storage.readLastScan()
    this.state.user = await this.storage.readUser()
    this.updateService.start(config.updates.intervalMs)

    if (this.state.user) {
      this.state.currentScan.companyName = this.state.user.companyName
      await this.startScanFlow('Running initial scan...')
      return
    }

    this.patchState({
      screen: 'email',
      busy: false,
      title: 'AdvisorArmor',
      message: null
    })
  }

  getState(): RendererState {
    return this.state
  }

  async submitEmail(email: string): Promise<void> {
    this.patchState({
      busy: true,
      errorMessage: null,
      title: 'AdvisorArmor',
      message: 'Validating email address...'
    })

    try {
      const isValid = await this.backend.validateEmail(email)
      if (!isValid) {
        this.patchState({
          busy: false,
          errorMessage: 'Unable to validate your email address. Please try again.'
        })
        return
      }

      const access = await this.backend.checkAccess(email)
      this.pendingAccessContext = {
        email,
        companyName: access.companyName,
        isAdmin: access.admin
      }
      this.patchState({
        screen: 'code',
        busy: false,
        pendingEmail: email,
        message: 'Please enter the latest verification code sent to your email',
        errorMessage: null
      })
    } catch (error) {
      logger.error('Submit email failed', error)
      this.patchState({
        busy: false,
        errorMessage: 'Unable to validate your email address. Please try again.'
      })
    }
  }

  async submitCode(code: string): Promise<void> {
    const pending = this.pendingAccessContext
    if (!pending) {
      this.patchState({
        screen: 'email',
        busy: false,
        errorMessage: 'Please enter your email address again.'
      })
      return
    }

    this.patchState({
      busy: true,
      errorMessage: null,
      message: 'Validating code...'
    })

    try {
      const isValid = await this.backend.validateCode(pending.email, code)
      if (!isValid) {
        this.patchState({
          busy: false,
          errorMessage: 'Unable to verify your code. Please try again.'
        })
        return
      }

      const user: UserInfo = {
        email: pending.email,
        companyName: pending.companyName,
        isAdmin: pending.isAdmin
      }
      await this.storage.writeUser(user)
      this.pendingAccessContext = null
      this.patchState({
        user,
        currentScan: {
          ...this.state.currentScan,
          companyName: user.companyName
        }
      })
      await this.startScanFlow('Preparing your first scan...')
    } catch (error) {
      logger.error('Submit code failed', error)
      this.patchState({
        busy: false,
        errorMessage: 'Unable to verify your code. Please try again.'
      })
    }
  }

  async rescan(): Promise<void> {
    await this.startScanFlow('Running scan...')
  }

  async retryCurrentAction(): Promise<void> {
    await this.startScanFlow('Retrying scan...')
  }

  async logout(): Promise<void> {
    await this.storage.clearUser()
    await this.storage.clearLastScan()
    this.currentPolicy = null
    this.pendingAccessContext = null
    this.clearScheduledScan()
    this.patchState({
      screen: 'email',
      busy: false,
      title: 'AdvisorArmor',
      message: null,
      errorMessage: null,
      pendingEmail: null,
      user: null,
      lastScan: null,
      currentScan: {
        startedAt: null,
        durationMs: null,
        companyName: null,
        result: null
      },
      submission: {
        phase: 'idle',
        attempt: 0,
        maxAttempts: config.submission.maxAttempts,
        errorMessage: null
      }
    })
  }

  async openSupportEmail(): Promise<void> {
    await shell.openExternal(`mailto:${config.supportEmail}`)
  }

  async openTroubleshooting(): Promise<void> {
    await shell.openExternal(config.troubleshootingUrl)
  }

  async checkForUpdates(): Promise<void> {
    await this.updateService.checkForUpdates()
  }

  private async startScanFlow(message: string): Promise<void> {
    if (!this.state.user) {
      return
    }

    this.patchState({
      screen: 'loading',
      busy: true,
      title: 'Scanning device',
      message,
      errorMessage: null,
      currentScan: {
        ...this.state.currentScan,
        startedAt: new Date().toISOString(),
        durationMs: null,
        result: null,
        companyName: this.state.user.companyName
      },
      submission: {
        phase: 'idle',
        attempt: 0,
        maxAttempts: config.submission.maxAttempts,
        errorMessage: null
      }
    })

    const startedAt = Date.now()
    try {
      const isMacOS = process.platform === 'darwin'
      const policyResponse = await this.backend.fetchPolicy(this.state.user.email, isMacOS)
      this.currentPolicy = policyResponse.parsed
      const settings = await this.storage.writeSettings({
        scanIntervalHours: policyResponse.parsed.scanIntervalHours
      })

      const device = await readDeviceSnapshot()
      const result = evaluateDevice(device, policyResponse.parsed)
      const durationMs = Date.now() - startedAt
      const lastScan: LastScanMetadata = {
        completedAt: new Date().toISOString(),
        durationMs,
        overallStatus: result.status
      }
      await this.storage.writeLastScan(lastScan)
      this.scheduleNextScan(settings.scanIntervalHours)

      this.patchState({
        settings,
        lastScan,
        screen: 'results',
        busy: false,
        title: 'AdvisorArmor',
        message: null,
        errorMessage: null,
        currentScan: {
          startedAt: new Date(startedAt).toISOString(),
          durationMs,
          companyName: this.state.user.companyName,
          result
        }
      })

      await this.submitScanResult(device, result, this.state.user.email, policyResponse.parsed)
    } catch (error) {
      logger.error('Start scan flow failed', error)
      const genericMessage = 'AdvisorArmor needs an internet connection to run a scan.'
      if (isBackendError(error)) {
        logger.error('Backend failure classification', {
          type: error.type,
          statusCode: error.statusCode,
          details: error.details
        })
      }
      this.patchState({
        screen: 'blocking-error',
        busy: false,
        title: 'Scan unavailable',
        message: genericMessage,
        errorMessage: genericMessage
      })
    }
  }

  private async submitScanResult(
    device: Awaited<ReturnType<typeof readDeviceSnapshot>>,
    result: ScanResultData,
    email: string,
    policy: NormalizedPolicy
  ): Promise<void> {
    for (let attempt = 1; attempt <= config.submission.maxAttempts; attempt += 1) {
      this.patchState({
        submission: {
          phase: 'submitting',
          attempt,
          maxAttempts: config.submission.maxAttempts,
          errorMessage: null
        }
      })

      try {
        await this.backend.sendScanResult(device, result, email, policy)
        this.patchState({
          submission: {
            phase: 'succeeded',
            attempt,
            maxAttempts: config.submission.maxAttempts,
            errorMessage: null
          }
        })
        return
      } catch (error) {
        logger.error('Scan result submission failed', { attempt, error })
        if (attempt === config.submission.maxAttempts) {
          this.patchState({
            submission: {
              phase: 'failed',
              attempt,
              maxAttempts: config.submission.maxAttempts,
              errorMessage: 'Results could not be submitted. Please check your connection.'
            }
          })
          return
        }
        await delay(config.submission.retryDelayMs)
      }
    }
  }

  private scheduleNextScan(scanIntervalHours: number): void {
    this.clearScheduledScan()
    this.scanTimer = setTimeout(() => {
      void this.startScanFlow('Running scheduled scan...')
    }, scanIntervalHours * 60 * 60 * 1000)
  }

  private clearScheduledScan(): void {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
  }

  private patchState(patch: Partial<RendererState>): void {
    this.state = {
      ...this.state,
      ...patch
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('app:state-changed', this.state)
    }
    this.emit('state-changed', this.state)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
