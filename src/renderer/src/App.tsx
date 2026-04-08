import { useEffect, useMemo, useState } from 'react'
import type { RendererState, ScanElementResult } from '@shared/models'
import { FAIL, NUDGE } from '@shared/status'

type TabKey = 'scan' | 'training' | 'report' | 'news'

const initialState: RendererState = {
  screen: 'loading',
  busy: true,
  title: 'Loading AdvisorArmor',
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
    maxAttempts: 3,
    errorMessage: null
  },
  update: {
    available: false,
    downloaded: false,
    message: null
  }
}

export function App(): JSX.Element {
  const [state, setState] = useState<RendererState>(initialState)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [tab, setTab] = useState<TabKey>('scan')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!window.deviceWatch) {
      setState(current => ({
        ...current,
        screen: 'blocking-error',
        busy: false,
        title: 'Renderer bridge unavailable',
        message: 'The preload bridge did not load correctly.',
        errorMessage: 'The preload bridge did not load correctly.'
      }))
      return
    }

    let unsubscribed = false
    void window.deviceWatch.getState().then(currentState => {
      if (!unsubscribed) {
        setState(currentState)
      }
    }).catch(error => {
      console.error('Failed to fetch initial renderer state', error)
      setState(current => ({
        ...current,
        screen: 'blocking-error',
        busy: false,
        title: 'Initial state failed',
        message: 'The application state could not be loaded.',
        errorMessage: 'The application state could not be loaded.'
      }))
    })
    const unsubscribe = window.deviceWatch.subscribeState(nextState => {
      setState(nextState)
    })
    return () => {
      unsubscribed = true
      unsubscribe()
    }
  }, [])

  const submissionMessage = useMemo(() => {
    if (state.submission.phase === 'submitting') {
      return state.submission.attempt === 1
        ? 'Submitting results...'
        : `Submitting results (attempt ${state.submission.attempt} of ${state.submission.maxAttempts})...`
    }
    return state.submission.errorMessage
  }, [state.submission])

  if (state.screen === 'email' || state.screen === 'code') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-900 px-6 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 shadow-panel backdrop-blur">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold">
              AA
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">AdvisorArmor</h1>
          </div>

          {state.screen === 'email' ? (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void window.deviceWatch.submitEmail({ email })
              }}
            >
              <label className="block text-sm text-white/80" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
              <button
                className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-brand-900 disabled:opacity-60"
                type="submit"
                disabled={state.busy || email.length === 0}
              >
                Login
              </button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void window.deviceWatch.submitCode({ code })
              }}
            >
              <p className="text-sm text-white/75">
                Please enter the latest verification code sent to your email.
              </p>
              <input
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white outline-none placeholder:text-white/40"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={code}
                onChange={event =>
                  setCode(event.target.value.replace(/\D+/g, '').slice(0, 4))
                }
              />
              <button
                className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-brand-900 disabled:opacity-60"
                type="submit"
                disabled={state.busy || code.length !== 4}
              >
                Verify
              </button>
            </form>
          )}

          <div className="mt-4 min-h-6 text-center text-sm text-white/80">
            {state.errorMessage ?? state.message}
          </div>
        </div>
      </main>
    )
  }

  if (state.screen === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-brand-500" />
          <h1 className="text-2xl font-semibold text-slate-900">{state.title}</h1>
          <p className="mt-2 text-slate-500">{state.message}</p>
        </div>
      </main>
    )
  }

  if (state.screen === 'blocking-error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-lg rounded-3xl bg-white p-10 shadow-panel">
          <h1 className="text-2xl font-semibold text-slate-900">{state.title}</h1>
          <p className="mt-3 text-slate-600">{state.message}</p>
          <div className="mt-8">
            <button
              className="rounded-2xl bg-brand-500 px-5 py-3 font-semibold text-white"
              type="button"
              onClick={() => {
                void window.deviceWatch.retryCurrentAction()
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    )
  }

  const result = state.currentScan.result
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="bg-brand-700 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl gap-6">
          {(['scan', 'training', 'report', 'news'] as const).map(item => (
            <button
              key={item}
              className={`border-b-2 pb-2 text-sm font-semibold uppercase tracking-[0.2em] ${
                item === tab ? 'border-white' : 'border-transparent text-white/70'
              }`}
              type="button"
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {tab !== 'scan' ? (
          <section className="rounded-3xl bg-white p-10 shadow-panel">
            <h2 className="text-2xl font-semibold capitalize">{tab}</h2>
            <p className="mt-3 text-slate-500">Coming soon.</p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl bg-white shadow-panel">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Device</p>
                  <h1 className="text-2xl font-semibold">
                    {state.currentScan.companyName ?? state.user?.companyName ?? 'AdvisorArmor'}
                  </h1>
                  <p className="mt-1 text-slate-500">{state.user?.email}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  {state.currentScan.result?.status ?? state.lastScan?.overallStatus ?? 'PASS'}
                </div>
              </div>
              <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
                <InfoItem label="Manufacturer" value={navigator.platform.includes('Mac') ? 'Apple' : 'Microsoft'} />
                <InfoItem label="Platform" value={navigator.platform} />
                <InfoItem
                  label="Last scanned"
                  value={state.lastScan ? formatTimestamp(state.lastScan.completedAt) : 'Not yet'}
                />
              </div>
            </section>

            <section className={`mt-6 rounded-3xl p-6 text-white ${statusBannerClass(result?.status)}`}>
              <h2 className="text-2xl font-semibold">
                {result?.status === FAIL
                  ? 'This device needs attention'
                  : result?.status === NUDGE
                    ? 'This device has recommendations'
                    : 'This device is properly configured'}
              </h2>
              <p className="mt-2 text-white/85">
                {result
                  ? 'Review each policy item below for details and remediation guidance.'
                  : 'A scan result will appear here after the first successful run.'}
              </p>
            </section>

            {submissionMessage ? (
              <section
                className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                  state.submission.phase === 'failed'
                    ? 'border-danger/20 bg-red-50 text-danger'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {submissionMessage}
              </section>
            ) : null}

            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {state.currentScan.companyName ?? state.user?.companyName ?? 'Company'} Cybersecurity Policy
                </h3>
                {state.currentScan.durationMs ? (
                  <span className="text-sm text-slate-500">
                    Scan duration {(state.currentScan.durationMs / 1000).toFixed(2)} seconds
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                {result?.elements.map(item => (
                  <ScanRow
                    key={item.key}
                    item={item}
                    expanded={expanded === item.key}
                    onToggle={() =>
                      setExpanded(current => (current === item.key ? null : item.key))
                    }
                  />
                ))}
              </div>
            </section>

            <footer className="mt-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-panel md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-500">
                {state.lastScan
                  ? `Last scanned ${formatTimestamp(state.lastScan.completedAt)}`
                  : 'No successful scan recorded yet.'}
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-2xl bg-brand-500 px-5 py-3 font-semibold text-white"
                  type="button"
                  onClick={() => {
                    void window.deviceWatch.rescan()
                  }}
                >
                  RESCAN
                </button>
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700"
                  type="button"
                  onClick={() => {
                    void window.deviceWatch.logout()
                  }}
                >
                  LOG OUT
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  )
}

function InfoItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}

function ScanRow({
  item,
  expanded,
  onToggle
}: {
  item: ScanElementResult
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-panel">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        type="button"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${statusPillClass(item.status)}`}>
            {item.status === FAIL ? '✕' : item.status === NUDGE ? '!' : '✓'}
          </span>
          <div>
            <h4 className="font-semibold text-slate-900">{item.title}</h4>
            <p className="text-sm text-slate-500">{item.detail}</p>
          </div>
        </div>
        <span className="text-slate-400">{expanded ? '−' : '+'}</span>
      </button>
      {expanded ? (
        <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
          <p>{item.description}</p>
          <p className="mt-3 font-medium text-slate-800">Recommended action</p>
          <p className="mt-1">{item.fixInstruction}</p>
        </div>
      ) : null}
    </article>
  )
}

function statusBannerClass(status: string | undefined): string {
  if (status === FAIL) {
    return 'bg-danger'
  }
  if (status === NUDGE) {
    return 'bg-warning'
  }
  return 'bg-success'
}

function statusPillClass(status: string): string {
  if (status === FAIL) {
    return 'bg-red-50 text-danger'
  }
  if (status === NUDGE) {
    return 'bg-amber-50 text-warning'
  }
  return 'bg-emerald-50 text-success'
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
