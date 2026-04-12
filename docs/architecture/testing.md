---
status: active
audience: both
created: 2026-04-08
---

# Testing Strategy

## Goals

- Keep fast feedback for pure logic and UI flows
- Cover backend-facing behaviour without needing live services
- Avoid brittle CI that depends on real macOS or Windows device state
- Put most test effort into normalization, orchestration, and user-visible behaviour

## Tooling

| Area                   | Tooling                        | Notes                                                          |
| ---------------------- | ------------------------------ | -------------------------------------------------------------- |
| Unit and service tests | Vitest                         | Default runner for TypeScript logic                            |
| Renderer UI tests      | Vitest + React Testing Library | Preferred for onboarding, results UI, and error states         |
| HTTP mocking           | MSW                            | Preferred over ad hoc `fetch` stubs for backend contract tests |
| End-to-end tests       | Playwright                     | Reserved for a small number of high-value Electron flows       |
| IPC boundary tests     | Thin custom fakes              | Keep preload/main contracts explicit and local to the codebase |

## Recommended Test Split

### Test-first or near-test-first

Use a test-first or very-close-after approach for:

- policy parsing and normalization
- scan evaluation logic
- backend request shaping
- backend timeout handling
- submission retry behaviour
- config-driven mock/backend switching

These areas are deterministic and easy to lock down with fixtures.

### Implement first, then test immediately

Use implementation-first followed by focused tests for:

- renderer screen wiring
- Electron main-process orchestration
- tray/menu interactions
- update prompt flows

Strict TDD is less valuable here because the work is more event-driven and integration-heavy.

### Spike first, then codify

For OS command checks:

- first verify the command strategy and output shape on the target platform
- then add parser tests using saved command-output fixtures
- then add command-runner tests using fakes and timeout/error cases

Do not depend on live machine settings in CI for scan-check coverage.

## Mock Mode in Tests

Tests should not all run under one blanket rule.

### Use mock backend mode by default for:

- onboarding flow tests
- results flow tests
- Playwright happy-path tests
- renderer tests that need predictable backend responses

### Do not rely on global mock mode for:

- parser tests
- retry and timeout tests
- error-classification tests
- command-runner tests
- policy normalization tests using explicit fixtures

Those tests should control their inputs directly.

## HTTP Mocking

Use MSW for HTTP-level tests in renderer and service-layer code.

Reasons:

- keeps request and response handling close to real usage
- reduces brittle per-test fetch stubbing
- makes timeout and error-path tests easier to read

MSW should mirror the real backend contracts already documented in `docs/architecture/api-contract.md`.

## OS Scan Testing

The scan engine should be tested at three levels:

1. parser tests using stored stdout fixtures
2. command-runner tests using fake process results and timeout/error cases
3. evaluator tests using normalized device-state inputs

Do not make CI depend on:

- actual firewall state
- actual disk encryption state
- actual installed apps
- actual Wi-Fi state
- actual registry or system preference values

## End-to-End Coverage

Keep Playwright focused on a few high-value flows:

- first-run onboarding
- successful scan and results display
- offline or policy-fetch failure state
- update prompt rendering

Do not try to use Playwright to exhaustively cover every scan result permutation.

## Practical Rule

Prefer fixtures and deterministic fakes for:

- backend responses
- IPC responses
- shell command output

Use a small number of end-to-end tests to prove the wiring between Electron main, preload, and renderer.
