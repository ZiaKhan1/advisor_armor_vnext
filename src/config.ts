import { app } from 'electron'

const env = process.env

export const config = {
  productName: 'AdvisorArmor',
  displayName: 'Advisor Armor',
  internalProductName: 'DeviceWatch',
  supportEmail: env.SUPPORT_EMAIL ?? 'support@example.com',
  troubleshootingUrl:
    env.TROUBLESHOOTING_URL ?? 'https://example.com/troubleshooting',
  useMockBackend: env.USE_MOCK_BACKEND !== 'false',
  mockOtpCode: env.MOCK_OTP_CODE ?? '1234',
  backend: {
    validateEmailUrl:
      env.VALIDATE_EMAIL_URL ?? 'https://example.com/validate-email',
    validateCodeUrl:
      env.VALIDATE_CODE_URL ?? 'https://example.com/validate-code',
    checkAccessUrl: env.CHECK_ACCESS_URL ?? 'https://example.com/check-access',
    policyUrl: env.POLICY_URL ?? 'https://example.com/policy',
    sendScanResultUrl:
      env.SEND_SCAN_RESULT_URL ?? 'https://example.com/send-scan-result'
  },
  timeoutsMs: {
    validateEmail: 20_000,
    validateCode: 20_000,
    checkAccess: 20_000,
    policy: 30_000,
    sendScanResult: 20_000
  },
  submission: {
    maxAttempts: 3,
    retryDelayMs: 5_000
  },
  connectivity: {
    probeUrl: 'https://www.google.com',
    maxAttempts: 60,
    retryDelayMs: 2_000
  },
  networkId: {
    primaryUrl: 'https://whatismyip.akamai.com',
    fallbackUrl: 'https://ifconfig.co/ip'
  },
  updates: {
    intervalMs: 24 * 60 * 60 * 1000
  },
  isPackaged: app?.isPackaged ?? false
} as const
