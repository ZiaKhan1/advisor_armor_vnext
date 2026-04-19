import type {
  WifiSecurityAssessment,
  WifiSecurityReason,
  WifiSecurityStatus
} from '@shared/models'

export interface WifiSecurityFacts {
  ssid?: string
  security?: string
  securityRawValue?: number
  authentication?: string | string[]
  cipher?: string | string[]
}

interface Classification {
  status: WifiSecurityStatus
  reason: WifiSecurityReason
  reasonText: string
  detail: string
}

export const UNKNOWN_CURRENT_WIFI_ASSESSMENT: WifiSecurityAssessment = {
  status: 'unknown',
  reason: 'unknown',
  securityLabel: 'Unknown',
  reasonText: 'security could not be determined',
  detail: 'Current Wi-Fi security could not be determined.'
}

export function classifyMacWifiSecurity(
  facts: WifiSecurityFacts,
  subject = 'Current Wi-Fi'
): WifiSecurityAssessment {
  const securityRawValue = facts.securityRawValue
  const securityLabel = facts.security ?? 'Unknown'
  const classification = classifyMacSecurityRawValue(securityRawValue)

  return buildAssessment(facts, securityLabel, classification, subject)
}

export function classifyWindowsWifiSecurity(
  facts: WifiSecurityFacts,
  subject = 'Current Wi-Fi'
): WifiSecurityAssessment {
  const authentication = firstString(facts.authentication) ?? ''
  const cipher = firstString(facts.cipher) ?? ''
  const securityLabel = [authentication, cipher].filter(Boolean).join(' / ')
  const classification = classifyWindowsSecurity(authentication, cipher)

  return buildAssessment(
    facts,
    securityLabel || 'Unknown',
    classification,
    subject
  )
}

export function classifyWindowsKnownWifiSecurity(
  facts: WifiSecurityFacts,
  subject = 'Saved Wi-Fi network'
): WifiSecurityAssessment {
  const authentications = toStringArray(facts.authentication)
  const ciphers = toStringArray(facts.cipher)
  const authenticationValues =
    authentications.length > 0 ? authentications : ['']
  const cipherValues = ciphers.length > 0 ? ciphers : ['']

  const assessments = authenticationValues.flatMap((authentication) =>
    cipherValues.map((cipher) =>
      classifyWindowsWifiSecurity(
        {
          ...facts,
          authentication,
          cipher
        },
        subject
      )
    )
  )

  const insecure = assessments.find(
    (assessment) => assessment.status === 'insecure'
  )
  if (insecure) {
    return buildKnownWindowsAssessment(facts, insecure, subject)
  }

  const secure = assessments.find(
    (assessment) => assessment.status === 'secure'
  )
  if (secure) {
    return buildKnownWindowsAssessment(facts, secure, subject)
  }

  return buildKnownWindowsAssessment(
    facts,
    {
      status: 'unknown',
      reason: 'unknown',
      reasonText: 'security could not be determined',
      securityLabel: buildWindowsSecurityLabel(facts),
      detail: `${subject} security could not be determined.`
    },
    subject
  )
}

export function classifyMacSecurityRawValue(
  securityRawValue: number | undefined
): Classification {
  switch (securityRawValue) {
    case 0:
      return {
        status: 'insecure',
        reason: 'no-password',
        reasonText: 'does not require a password',
        detail: 'does not require a password.'
      }
    case 1:
    case 6:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        reasonText: 'uses outdated WEP security',
        detail: 'uses outdated WEP security.'
      }
    case 2:
    case 7:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        reasonText: 'uses outdated WPA security',
        detail: 'uses outdated WPA security.'
      }
    case 3:
    case 8:
      return {
        status: 'insecure',
        reason: 'weak-protocol',
        reasonText: 'allows older WPA security',
        detail: 'allows older WPA security.'
      }
    case 4:
    case 9:
    case 11:
    case 12:
    case 13:
      return {
        status: 'secure',
        reason: 'modern-protocol',
        reasonText: 'uses a modern security mode',
        detail: 'uses a modern security mode.'
      }
    case 14:
    case 15:
      return {
        status: 'insecure',
        reason: 'no-password',
        reasonText: 'encrypts Wi-Fi traffic but does not require a password',
        detail: 'encrypts Wi-Fi traffic but does not require a password.'
      }
    default:
      return {
        status: 'unknown',
        reason: 'unknown',
        reasonText: 'security could not be determined',
        detail: 'security could not be determined.'
      }
  }
}

export function classifyWindowsSecurity(
  authentication: string,
  cipher: string
): Classification {
  const normalizedAuth = normalizeSecurityValue(authentication)
  const normalizedCipher = normalizeSecurityValue(cipher)

  if (!normalizedAuth && !normalizedCipher) {
    return {
      status: 'unknown',
      reason: 'unknown',
      reasonText: 'security could not be determined',
      detail: 'security could not be determined.'
    }
  }

  if (normalizedAuth === 'OPEN' || normalizedAuth === 'OWE') {
    return {
      status: 'insecure',
      reason: 'no-password',
      reasonText:
        normalizedAuth === 'OWE'
          ? 'encrypts Wi-Fi traffic but does not require a password'
          : 'does not require a password',
      detail:
        normalizedAuth === 'OWE'
          ? 'encrypts Wi-Fi traffic but does not require a password.'
          : 'does not require a password.'
    }
  }

  if (
    normalizedAuth === 'SHAREDKEY' ||
    normalizedAuth.includes('WEP') ||
    ['WEP', 'WEP40', 'WEP104'].includes(normalizedCipher)
  ) {
    return {
      status: 'insecure',
      reason: 'weak-protocol',
      reasonText: 'uses outdated WEP security',
      detail: 'uses outdated WEP security.'
    }
  }

  if (
    normalizedAuth === 'WPA' ||
    normalizedAuth === 'WPAPSK' ||
    normalizedAuth === 'WPAPERSONAL' ||
    normalizedAuth === 'WPAENTERPRISE'
  ) {
    return {
      status: 'insecure',
      reason: 'weak-protocol',
      reasonText: 'uses outdated WPA security',
      detail: 'uses outdated WPA security.'
    }
  }

  if (normalizedCipher === 'TKIP') {
    return {
      status: 'insecure',
      reason: 'weak-protocol',
      reasonText: 'uses weak Wi-Fi security',
      detail: 'uses weak Wi-Fi security.'
    }
  }

  if (
    normalizedAuth === 'RSNA' ||
    normalizedAuth === 'RSNAPSK' ||
    normalizedAuth === 'WPA2PERSONAL' ||
    normalizedAuth === 'WPA2ENTERPRISE' ||
    normalizedAuth === 'WPA2PSK'
  ) {
    return ['CCMP', 'CCMP256', 'GCMP', 'GCMP256'].includes(normalizedCipher)
      ? {
          status: 'secure',
          reason: 'modern-protocol',
          reasonText: 'uses a modern security mode',
          detail: 'uses a modern security mode.'
        }
      : {
          status: 'unknown',
          reason: 'unknown',
          reasonText: 'security could not be determined',
          detail: 'security could not be determined.'
        }
  }

  if (
    normalizedAuth === 'WPA3SAE' ||
    normalizedAuth === 'WPA3PERSONAL' ||
    normalizedAuth === 'WPA3ENTERPRISE' ||
    normalizedAuth === 'WPA3ENTERPRISE192BIT'
  ) {
    return {
      status: 'secure',
      reason: 'modern-protocol',
      reasonText: 'uses a modern security mode',
      detail: 'uses a modern security mode.'
    }
  }

  return {
    status: 'unknown',
    reason: 'unknown',
    reasonText: 'security could not be determined',
    detail: 'security could not be determined.'
  }
}

function buildAssessment(
  facts: WifiSecurityFacts,
  securityLabel: string,
  classification: Classification,
  subject: string
): WifiSecurityAssessment {
  const subjectPrefix = facts.ssid ? `${subject} "${facts.ssid}"` : subject
  const detail =
    classification.status === 'secure'
      ? `${subjectPrefix} uses a modern security mode: ${securityLabel}.`
      : `${subjectPrefix} ${classification.detail}`

  return {
    status: classification.status,
    reason: classification.reason,
    reasonText: classification.reasonText,
    securityLabel,
    detail
  }
}

function buildKnownWindowsAssessment(
  facts: WifiSecurityFacts,
  assessment: WifiSecurityAssessment,
  subject: string
): WifiSecurityAssessment {
  const securityLabel = buildWindowsSecurityLabel(facts)
  const subjectPrefix = facts.ssid ? `${subject} "${facts.ssid}"` : subject

  return {
    ...assessment,
    securityLabel,
    detail:
      assessment.status === 'secure'
        ? `${subjectPrefix} uses a modern security mode: ${securityLabel}.`
        : `${subjectPrefix} ${assessment.reasonText}.`
  }
}

function buildWindowsSecurityLabel(facts: WifiSecurityFacts): string {
  const authentication = toStringArray(facts.authentication).join(', ')
  const cipher = toStringArray(facts.cipher).join(', ')
  return [authentication, cipher].filter(Boolean).join(' / ') || 'Unknown'
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return typeof value === 'string' && value.trim() ? [value.trim()] : []
}

function firstString(value: unknown): string | undefined {
  return toStringArray(value)[0]
}

function normalizeSecurityValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
