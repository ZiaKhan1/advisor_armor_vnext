import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DeviceWatchApi } from '@shared/ipc'
import type { RendererState, ScanElementResult } from '@shared/models'
import { FAIL, NUDGE, PASS } from '@shared/status'
import { App } from './App'

function createScanElement(
  overrides: Partial<ScanElementResult> = {}
): ScanElementResult {
  return {
    key: 'firewall',
    title: 'Firewall',
    status: PASS,
    description: 'Firewall protects this device from unwanted inbound traffic.',
    detail: 'Firewall is enabled.',
    fixInstruction: 'Keep firewall enabled.',
    ...overrides
  }
}

function createRendererState(
  overrides: Partial<RendererState> = {}
): RendererState {
  return {
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
    },
    ...overrides
  }
}

function createResultsState(
  overrides: Partial<RendererState> = {}
): RendererState {
  return createRendererState({
    screen: 'results',
    user: {
      email: 'admin@example.com',
      isAdmin: true,
      companyName: 'Example Advice'
    },
    lastScan: {
      completedAt: '2026-04-12T02:15:00.000Z',
      durationMs: 1500,
      overallStatus: FAIL
    },
    currentScan: {
      startedAt: '2026-04-12T02:14:58.500Z',
      durationMs: 1500,
      companyName: 'Example Advice',
      result: {
        status: FAIL,
        osVersion: PASS,
        firewall: FAIL,
        diskEncryption: PASS,
        winDefenderAV: PASS,
        screenLock: PASS,
        screenIdle: PASS,
        automaticUpdates: PASS,
        remoteLogin: PASS,
        activeWifiNetwork: PASS,
        knownWifiNetworks: PASS,
        networkID: PASS,
        networkIDInUse: 'Example Wi-Fi',
        applications: NUDGE,
        appsPolicyResult: {
          appsScanResult: NUDGE,
          installedProhibitedApps: [],
          missingRequiredAppsCategories: ['Password manager']
        },
        elements: [
          createScanElement({
            key: 'firewall',
            title: 'Firewall',
            status: FAIL,
            detail: 'Firewall is disabled.',
            description:
              'Firewall protects this device from unwanted inbound traffic.',
            descriptionSteps: [
              {
                text: 'Click ',
                linkText: 'Network',
                linkUrl:
                  'x-apple.systempreferences:com.apple.Network-Settings.extension',
                suffix: '.'
              }
            ],
            fixInstruction: 'Enable the firewall in system settings.'
          }),
          createScanElement({
            key: 'applications',
            title: 'Applications',
            status: NUDGE,
            detail: 'One required app category is missing.',
            description:
              'Required security applications help protect the device.',
            fixInstruction: 'Install an approved password manager.'
          })
        ]
      }
    },
    ...overrides
  })
}

function installDeviceWatch(state: RendererState): DeviceWatchApi {
  const api: DeviceWatchApi = {
    getState: async () => state,
    subscribeState: () => () => undefined,
    submitEmail: async () => undefined,
    submitCode: async () => undefined,
    rescan: async () => undefined,
    retryCurrentAction: async () => undefined,
    logout: async () => undefined,
    openSupportEmail: async () => undefined,
    openTroubleshooting: async () => undefined,
    openFirewallSettings: async () => undefined
  }
  window.deviceWatch = api
  return api
}

beforeEach(() => {
  installDeviceWatch(createRendererState())
})

it('renders login screen', async () => {
  render(<App />)
  expect(await screen.findByText('AdvisorArmor')).toBeInTheDocument()
  expect(screen.getByLabelText('Email address')).toBeInTheDocument()
})

it('renders company header compactly and expands details on click', async () => {
  const user = userEvent.setup()
  installDeviceWatch(createResultsState())

  render(<App />)

  const companyHeader = await screen.findByRole('button', {
    name: /example advice/i
  })
  expect(screen.getByText('admin@example.com')).toBeInTheDocument()
  expect(screen.queryByText('Manufacturer')).not.toBeInTheDocument()

  await user.click(companyHeader)

  expect(screen.getByText('Manufacturer')).toBeInTheDocument()
  expect(screen.getByText('Platform')).toBeInTheDocument()
  expect(screen.getByText('Last scanned')).toBeInTheDocument()
})

it('shows needs attention as an inline status summary', async () => {
  installDeviceWatch(createResultsState())

  render(<App />)

  expect(await screen.findByText('Needs attention')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Review the policy items below for details and next steps.'
    )
  ).toBeInTheDocument()
})

it('expands and collapses scan row details', async () => {
  const user = userEvent.setup()
  installDeviceWatch(createResultsState())

  render(<App />)

  const firewallRow = await screen.findByRole('button', { name: /firewall/i })
  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()

  await user.click(firewallRow)

  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Network' })).toHaveAttribute(
    'href',
    'x-apple.systempreferences:com.apple.Network-Settings.extension'
  )
  expect(
    screen.queryByText('Enable the firewall in system settings.')
  ).not.toBeInTheDocument()

  await user.click(firewallRow)

  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
})

it('shows recommended action for non-firewall scan rows', async () => {
  const user = userEvent.setup()
  installDeviceWatch(createResultsState())

  render(<App />)

  const applicationsRow = await screen.findByRole('button', {
    name: /applications/i
  })

  await user.click(applicationsRow)

  expect(screen.getByText('Recommended action')).toBeInTheDocument()
  expect(
    screen.getByText('Install an approved password manager.')
  ).toBeInTheDocument()
})

it('keeps footer actions available', async () => {
  installDeviceWatch(createResultsState())

  render(<App />)

  expect(
    await screen.findByRole('button', { name: 'RESCAN' })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'LOG OUT' })).toBeInTheDocument()
})
