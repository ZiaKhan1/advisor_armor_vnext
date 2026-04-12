---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# White-Labelling

DeviceWatch is designed to be adopted by a single organisation. The codebase is generic by default (mock mode) and all organisation-specific values are committed in one config file that is switched in at build time.

Use `DeviceWatch` for generic code, docs, and architecture naming. Use client-specific names such as `AdvisorArmor` only where branding or backend contracts require them.

Within the codebase, prefer generic names for shared concepts. For example, keep version data as `appVersion` internally and map it to the backend field `advisorArmorVersion` only when constructing API requests.

## Principle

- The base application runs in **mock mode** out of the box — no backend required
- All organisation-specific values (API URLs, branding, contact info) live in **one committed config file**
- A single flag (`useMockBackend`) controls whether the app uses mock or real behaviour throughout the codebase

## Config File

```
src/config.ts
```

Single file, committed to the repo. Contains all configurable values:

```ts
export const config = {
  validateEmailUrl: 'https://api.acme.com/devicewatch/validate-email',
  validateCodeUrl: 'https://api.acme.com/devicewatch/validate-code',
  checkAccessUrl: 'https://api.acme.com/devicewatch/check-access',
  policyUrl: 'https://api.acme.com/devicewatch/policy',
  sendScanResultUrl: 'https://api.acme.com/devicewatch/send-scan-result',
  appName: 'AdvisorArmor',
  supportEmail: 'it@acme.com',
  troubleshootingUrl: 'https://acme.com/it/help',
  mockOtpCode: '1234',
  useMockBackend: import.meta.env.VITE_MOCK_MODE === 'true',
  validateEmailTimeoutMs: 20_000,
  validateCodeTimeoutMs: 20_000,
  checkAccessTimeoutMs: 20_000,
  policyTimeoutMs: 30_000,
  sendScanResultTimeoutMs: 20_000,
  sendScanResultRetryMaxAttempts: 3,
  sendScanResultRetryDelayMs: 5_000
}
```

`useMockBackend` is the only value driven by an environment variable — everything else is hardcoded in the file.

## Switching Modes

Controlled via npm scripts:

```json
"dev":        "electron .",
"dev:mock":   "VITE_MOCK_MODE=true electron .",
"build":      "electron-builder",
"build:mock": "VITE_MOCK_MODE=true electron-builder"
```

- Default dev and build use real (company) values
- `:mock` variants override `useMockBackend` to `true` via the environment variable
- Tests always run in mock mode (see below)

## Mock Behaviour in Code

Service-layer code checks `config.useMockBackend` to decide whether to call real APIs or return mock responses:

```ts
import { config } from '@/config'

async function fetchPolicy() {
  if (config.useMockBackend) return mockPolicyResponse
  return await api.post(config.policyUrl, formData)
}
```

Mock responses are defined in code as typed constants, not in config or external JSON files.
They cover only the five backend APIs:

- `validateEmail`
- `validateCode`
- `checkAccess`
- `policy`
- `sendScanResult`

## OTP Verification in Mock Mode

When mock backend mode is enabled:

- any email can follow the successful onboarding path
- `checkAccess` returns one fixed `{ admin, companyName }` object
- the OTP step accepts `config.mockOtpCode` as the valid code (default: `1234`)
- policy fetch returns one fixed backend-shaped policy object for all users
- result submission always succeeds and returns plain text

## Testing

Mock backend mode should be the default for UI-flow and Playwright tests, but not a blanket rule for every test.

Use mock backend mode for:

- onboarding flow tests
- renderer happy-path tests
- Playwright tests that exercise backend-driven UI flows

Do not rely on global mock mode for:

- parser tests
- command-runner tests
- timeout and retry tests
- error-classification tests

When a test suite needs mock backend mode, set it directly in the test config so the suite stays self-contained regardless of how it is invoked:

```ts
// vitest.config.ts
process.env.VITE_MOCK_MODE = 'true'
```

See `docs/architecture/testing.md` for the broader test strategy.

## Logo

One file, committed to the repo:

```
assets/logo.png
```

## App Name & Icon (electron-builder)

`productName` and `appId` live in the `build` section of `package.json`. All other electron-builder settings are in `electron-builder.yml`.

```json
// package.json
{
  "name": "devicewatch",
  "build": {
    "productName": "Acme Security Monitor",
    "appId": "com.acme.devicewatch"
  }
}
```

## What Is Configurable

| Setting                          | Location                                       |
| -------------------------------- | ---------------------------------------------- |
| Backend endpoint URLs            | `src/config.ts`                                |
| Mock backend mode                | `src/config.ts` (toggled via `VITE_MOCK_MODE`) |
| Mock OTP code                    | `src/config.ts`                                |
| Backend client timeouts          | `src/config.ts`                                |
| Result submission retry settings | `src/config.ts`                                |
| App display name (UI)            | `src/config.ts`                                |
| Support email                    | `src/config.ts`                                |
| Troubleshooting URL              | `src/config.ts`                                |
| In-app logo                      | `assets/logo.png`                              |
| OS app name / installer name     | `package.json` → `build.productName`           |
| App ID                           | `package.json` → `build.appId`                 |
| App icon (dock/taskbar)          | `assets/icon/`                                 |
