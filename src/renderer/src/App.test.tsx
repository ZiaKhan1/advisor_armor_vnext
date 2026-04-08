import { render, screen } from '@testing-library/react'
import { App } from './App'

declare global {
  interface Window {
    deviceWatch: {
      getState: () => Promise<unknown>
      subscribeState: (listener: (state: unknown) => void) => () => void
      submitEmail: () => Promise<void>
      submitCode: () => Promise<void>
      rescan: () => Promise<void>
      retryCurrentAction: () => Promise<void>
      logout: () => Promise<void>
      openSupportEmail: () => Promise<void>
      openTroubleshooting: () => Promise<void>
    }
  }
}

beforeEach(() => {
  window.deviceWatch = {
    getState: async () => ({
      screen: 'email',
      busy: false,
      title: 'AdvisorArmor',
      message: null,
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
        maxAttempts: 3,
        errorMessage: null
      },
      update: {
        available: false,
        downloaded: false,
        message: null
      }
    }),
    subscribeState: () => () => undefined,
    submitEmail: async () => undefined,
    submitCode: async () => undefined,
    rescan: async () => undefined,
    retryCurrentAction: async () => undefined,
    logout: async () => undefined,
    openSupportEmail: async () => undefined,
    openTroubleshooting: async () => undefined
  }
})

it('renders login screen', async () => {
  render(<App />)
  expect(await screen.findByText('AdvisorArmor')).toBeInTheDocument()
  expect(screen.getByLabelText('Email address')).toBeInTheDocument()
})
