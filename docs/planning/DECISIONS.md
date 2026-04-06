---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# Decision Log

This file records planning decisions that were previously ambiguous across docs.

## Current Decisions

- Scope is defined across all documents in `docs/`; `PLAN.md` is the project entry point, not the only source of scope.
- OTP codes are 4 digits.
- Default result submission retry settings are 3 attempts with a 15 second delay.
- v1 includes the full scan set defined in `docs/architecture/scan-logic.md`.
- On auto-start/login, the app opens its main window immediately.
- On startup, the app checks for updates before continuing into the scan flow.
- The app also checks for updates at a regular interval and via the tray/menu bar action.
- Each scan fetches the latest policy; v1 does not run scans against a cached policy when offline.
- If offline, the app shows an error in the main window and blocks the scan.
- `Training`, `Report`, and `News` tabs are placeholders in v1.
- There is no separate API authentication layer in v1 beyond the email + verification code onboarding flow.
- `DeviceWatch` is the generic product/codebase name.
- `AdvisorArmor` should be used only where organisation-specific branding or backend contract values require it, such as API field names, visible app name, and installer branding.
- Internal code should prefer generic names such as `appVersion` and map them to backend-specific field names such as `advisorArmorVersion` at the API boundary.
- Windows app detection for app policy checks remains a research spike.
