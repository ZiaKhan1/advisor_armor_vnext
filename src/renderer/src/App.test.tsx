import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
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
    appTitle: 'Advisor Armor (v0.1.0)',
    busy: false,
    title: 'Advisor Armor (v0.1.0)',
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
            key: 'screenIdle',
            title: 'Screen Idle',
            status: PASS,
            detail: 'Company policy: 15 minutes. Your setting: 15 minutes.',
            description:
              'Screens which lock automatically when your laptop is unattended help prevent unauthorized access.',
            descriptionSteps: [
              {
                text: 'Open ',
                linkText: 'Lock Screen',
                linkUrl: 'x-apple.systempreferences:com.apple.Lock',
                suffix: ' on the left.'
              }
            ],
            fixInstruction:
              'Open System Settings > Lock Screen and reduce the screen saver idle timeout.'
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
    openFirewallSettings: async () => undefined,
    openDiskEncryptionSettings: async () => undefined,
    openAppStore: async () => undefined,
    openWifiSettings: async () => undefined,
    openRemoteLoginSettings: async () => undefined
  }
  window.deviceWatch = api
  return api
}

beforeEach(() => {
  installDeviceWatch(createRendererState())
})

it('renders login screen', async () => {
  render(<App />)
  expect(await screen.findByText('Advisor Armor (v0.1.0)')).toBeInTheDocument()
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

it('opens Screen Idle details without the recommended action footer', async () => {
  const user = userEvent.setup()
  installDeviceWatch(createResultsState())

  render(<App />)

  const screenIdleRow = await screen.findByRole('button', {
    name: /screen idle/i
  })

  await user.click(screenIdleRow)

  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Lock Screen' })).toHaveAttribute(
    'href',
    'x-apple.systempreferences:com.apple.Lock'
  )
})

it('opens Antivirus details without the recommended action footer', async () => {
  const user = userEvent.setup()
  installDeviceWatch(
    createResultsState({
      currentScan: {
        startedAt: '2026-04-12T02:14:58.500Z',
        durationMs: 1500,
        companyName: 'Example Advice',
        result: {
          status: PASS,
          osVersion: PASS,
          firewall: PASS,
          diskEncryption: PASS,
          winDefenderAV: PASS,
          screenLock: PASS,
          screenIdle: PASS,
          automaticUpdates: PASS,
          remoteLogin: PASS,
          activeWifiNetwork: PASS,
          knownWifiNetworks: PASS,
          networkID: PASS,
          networkIDInUse: '',
          applications: PASS,
          appsPolicyResult: {
            appsScanResult: PASS,
            installedProhibitedApps: [],
            missingRequiredAppsCategories: []
          },
          elements: [
            createScanElement({
              key: 'winDefenderAV',
              title: 'Antivirus',
              status: PASS,
              detail:
                'Antivirus is currently providing real-time protection on your system.',
              description:
                'Real-time protection helps detect and block malware before it can install or run on your device.',
              descriptionSteps: [
                {
                  unnumbered: true,
                  text: 'Click ',
                  linkText: 'here',
                  linkUrl: 'windowsdefender://threat',
                  suffix: ' to check other antivirus protection settings.'
                }
              ],
              fixInstruction: 'No action required.'
            })
          ]
        }
      }
    })
  )

  render(<App />)

  const antivirusRow = await screen.findByRole('button', {
    name: /antivirus/i
  })

  await user.click(antivirusRow)

  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'here' })).toHaveAttribute(
    'href',
    'windowsdefender://threat'
  )
})

it('opens Applications details without the recommended action footer', async () => {
  const user = userEvent.setup()
  installDeviceWatch(createResultsState())

  render(<App />)

  const applicationsRow = await screen.findByRole('button', {
    name: /applications/i
  })

  await user.click(applicationsRow)

  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Install an approved password manager.')
  ).not.toBeInTheDocument()
  expect(
    screen.getByText('Required security applications help protect the device.')
  ).toBeInTheDocument()
})

it('groups missing required application categories in the Applications details', async () => {
  const user = userEvent.setup()
  installDeviceWatch(
    createResultsState({
      currentScan: {
        startedAt: '2026-04-12T02:14:58.500Z',
        durationMs: 1500,
        companyName: 'Example Advice',
        result: {
          status: FAIL,
          osVersion: PASS,
          firewall: PASS,
          diskEncryption: PASS,
          winDefenderAV: PASS,
          screenLock: PASS,
          screenIdle: PASS,
          automaticUpdates: PASS,
          remoteLogin: PASS,
          activeWifiNetwork: PASS,
          knownWifiNetworks: PASS,
          networkID: PASS,
          networkIDInUse: '',
          applications: FAIL,
          appsPolicyResult: {
            appsScanResult: FAIL,
            installedProhibitedApps: [],
            missingRequiredAppsCategories: ['Bitdefender, Avast']
          },
          elements: [
            createScanElement({
              key: 'applications',
              title: 'Applications',
              status: FAIL,
              detail: 'Some required applications are missing.',
              description: '',
              descriptionSteps: [
                {
                  text: 'Required Applications:',
                  secondaryText: ' Some required applications are missing',
                  status: FAIL,
                  unnumbered: true,
                  bold: true,
                  children: [
                    {
                      text: 'You must install 2 of the applications: Bitdefender, Avast',
                      children: [{ text: 'Only 1 is installed: Bitdefender' }]
                    },
                    {
                      text: 'You must install the application: AdvisorArmor2',
                      children: [{ text: 'It is not installed.' }]
                    }
                  ]
                }
              ],
              fixInstruction: ''
            })
          ]
        }
      }
    })
  )

  render(<App />)

  const applicationsRow = await screen.findByRole('button', {
    name: /applications/i
  })

  await user.click(applicationsRow)

  expect(
    screen.getByText(
      'You must install 2 of the applications: Bitdefender, Avast'
    )
  ).toBeInTheDocument()
  expect(
    screen.getByText('Only 1 is installed: Bitdefender')
  ).toBeInTheDocument()
  expect(
    screen.getByText('You must install the application: AdvisorArmor2')
  ).toBeInTheDocument()
  expect(screen.getByText('It is not installed.')).toBeInTheDocument()
})

it('renders Applications details compactly when the description is empty', async () => {
  const user = userEvent.setup()
  installDeviceWatch(
    createResultsState({
      currentScan: {
        startedAt: '2026-04-12T02:14:58.500Z',
        durationMs: 1500,
        companyName: 'Example Advice',
        result: {
          status: FAIL,
          osVersion: PASS,
          firewall: PASS,
          diskEncryption: PASS,
          winDefenderAV: PASS,
          screenLock: PASS,
          screenIdle: PASS,
          automaticUpdates: PASS,
          remoteLogin: PASS,
          activeWifiNetwork: PASS,
          knownWifiNetworks: PASS,
          networkID: PASS,
          networkIDInUse: '',
          applications: FAIL,
          appsPolicyResult: {
            appsScanResult: FAIL,
            installedProhibitedApps: ['ChatGPT'],
            missingRequiredAppsCategories: []
          },
          elements: [
            createScanElement({
              key: 'applications',
              title: 'Applications',
              status: FAIL,
              detail: 'There are applications installed which are prohibited.',
              description: '',
              descriptionSteps: [
                {
                  text: 'Prohibited Applications:',
                  secondaryText: ' 1 prohibited application is installed',
                  status: FAIL,
                  unnumbered: true,
                  bold: true,
                  children: [{ text: 'ChatGPT' }]
                }
              ],
              fixInstruction: ''
            })
          ]
        }
      }
    })
  )

  const { container } = render(<App />)

  const applicationsRow = await screen.findByRole('button', {
    name: /applications/i
  })

  await user.click(applicationsRow)

  const detailPanel = container.querySelector('.border-t.border-slate-100')
  const emptyParagraph = detailPanel?.querySelector('p:empty')

  expect(detailPanel).not.toBeNull()
  expect(emptyParagraph).toBeNull()
  expect(screen.getByText('Prohibited Applications:')).toBeInTheDocument()
})

it('opens disk encryption settings from a scan row action', async () => {
  const user = userEvent.setup()
  const api = installDeviceWatch(
    createResultsState({
      currentScan: {
        startedAt: '2026-04-12T02:14:58.500Z',
        durationMs: 1500,
        companyName: 'Example Advice',
        result: {
          status: FAIL,
          osVersion: PASS,
          firewall: PASS,
          diskEncryption: FAIL,
          winDefenderAV: PASS,
          screenLock: PASS,
          screenIdle: PASS,
          automaticUpdates: PASS,
          remoteLogin: PASS,
          activeWifiNetwork: PASS,
          knownWifiNetworks: PASS,
          networkID: PASS,
          networkIDInUse: '',
          applications: PASS,
          appsPolicyResult: {
            appsScanResult: PASS,
            installedProhibitedApps: [],
            missingRequiredAppsCategories: []
          },
          elements: [
            createScanElement({
              key: 'diskEncryption',
              title: 'Disk Encryption',
              status: FAIL,
              detail:
                'BitLocker appears to be turned off for the Windows system drive.',
              description:
                "Full-disk encryption protects data at rest from being accessed by a party who does not know the password or decryption key. Systems containing internal data should be encrypted. It is every employee's responsibility to keep internal data safe.",
              descriptionSteps: [
                {
                  text: 'Open ',
                  linkText: 'BitLocker Drive Encryption',
                  action: 'openDiskEncryptionSettings'
                }
              ],
              fixInstruction: 'Turn on BitLocker for the Windows system drive.'
            })
          ]
        }
      }
    })
  )
  const openDiskEncryptionSettings = vi.spyOn(api, 'openDiskEncryptionSettings')

  render(<App />)

  const diskEncryptionRow = await screen.findByRole('button', {
    name: /disk encryption/i
  })
  await user.click(diskEncryptionRow)
  await user.click(
    screen.getByRole('button', { name: 'BitLocker Drive Encryption' })
  )

  expect(openDiskEncryptionSettings).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Recommended action')).not.toBeInTheDocument()
})

it('keeps footer actions available', async () => {
  installDeviceWatch(createResultsState())

  render(<App />)

  expect(
    await screen.findByRole('button', { name: 'RESCAN' })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'LOG OUT' })).toBeInTheDocument()
})
