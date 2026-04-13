export const PASS = 'PASS'
export const FAIL = 'FAIL'
export const NUDGE = 'NUDGE'

export type PolicyStatus = typeof PASS | typeof FAIL | typeof NUDGE
export type OverallStatus = PolicyStatus

export function toPolicyStatus(value: string | null | undefined): PolicyStatus {
  if (!value) {
    return PASS
  }

  const normalized = value.toUpperCase()
  if (normalized === FAIL) {
    return FAIL
  }
  if (normalized === NUDGE) {
    return NUDGE
  }
  return PASS
}
