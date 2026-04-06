---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# White-Labelling

DeviceWatch is designed to be adopted by a single organisation. The codebase is generic by default (mock mode) and all organisation-specific values are committed in one config file that is switched in at build time.

## Principle

- The base application runs in **mock mode** out of the box — no backend required
- All organisation-specific values (API URLs, branding, contact info) live in **one committed config file**
- A single flag (`mockMode`) controls whether the app uses mock or real behaviour throughout the codebase

## Config File

```
src/config.ts
```

Single file, committed to the repo. Contains all configurable values:

```ts
export const config = {
  mockMode: import.meta.env.VITE_MOCK_MODE === 'true',
  apiBaseUrl: 'https://api.acme.com/devicewatch',
  appName: 'Acme Security Monitor',
  supportEmail: 'it@acme.com',
  troubleshootingUrl: 'https://acme.com/it/help',
  mockOtpCode: '123456',
}
```

`mockMode` is the only value driven by an environment variable — everything else is hardcoded in the file.

## Switching Modes

Controlled via npm scripts:

```json
"dev":        "electron .",
"dev:mock":   "VITE_MOCK_MODE=true electron .",
"build":      "electron-builder",
"build:mock": "VITE_MOCK_MODE=true electron-builder"
```

- Default dev and build use real (company) values
- `:mock` variants override `mockMode` to `true` via the environment variable
- Tests always run in mock mode (see below)

## Mock Behaviour in Code

Service-layer code checks `config.mockMode` to decide whether to call real APIs or return mock responses:

```ts
import { config } from '@/config'

async function fetchPolicy() {
  if (config.mockMode) return mockPolicyResponse
  return await api.get(config.apiBaseUrl + '/policy')
}
```

Mock responses are defined alongside the service, not in config.

## OTP Verification in Mock Mode

When `mockMode` is `true`, the OTP email step accepts `config.mockOtpCode` as the valid code (default: `123456`). No email is sent.

## Testing

Tests always run in mock mode. This is set directly in the test config — not relying on an env var — so tests are always self-contained regardless of how they are invoked:

```ts
// vitest.config.ts
process.env.VITE_MOCK_MODE = 'true'
```

E2E tests (Playwright) follow the same rule.

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

| Setting | Location |
|---|---|
| API base URL | `src/config.ts` |
| Mock mode | `src/config.ts` (toggled via `VITE_MOCK_MODE`) |
| Mock OTP code | `src/config.ts` |
| App display name (UI) | `src/config.ts` |
| Support email | `src/config.ts` |
| Troubleshooting URL | `src/config.ts` |
| In-app logo | `assets/logo.png` |
| OS app name / installer name | `package.json` → `build.productName` |
| App ID | `package.json` → `build.appId` |
| App icon (dock/taskbar) | `assets/icon/` |
