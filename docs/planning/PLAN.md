---
status: active
audience: both
created: 2026-04-05
deprecated: ~
---

# Project Plan

## Purpose
Advisor Armor is a desktop security compliance application that runs on employee machines (Mac and Windows). It scans the device against an organisation's security policy and reports results to both the user and a backend API. It helps organisations ensure employee devices meet their security standards without requiring IT to manually audit machines.

## Target Users
- **End users** — employees who run the app on their machines and see their scan results
- **IT admins** — view aggregated compliance reports via the backend (out of scope for this app; handled server-side)

## Goals
- Silently run scheduled compliance scans on employee devices
- Surface scan results clearly to the user (PASS / FAIL / NUDGE)
- Report scan results to backend for admin visibility
- Minimal friction — auto-start, runs in background, no repeated logins

## Out of Scope
- Remediation — app reads device settings only, never modifies them
- Admin dashboard — handled by backend/separate product
- Policy management — policy is owned by backend API

## Feature Scope (v1)

### Onboarding
- First launch: prompt user for email
- Send OTP to email, prompt user to verify
- Store verified email in local settings file
- Subsequent launches: use stored email silently

### Policy
- Fetch user policy from backend API using stored email
- Policy is org-level, returned as JSON per user email
- Policy defines per-scan-element behaviour: PASS / FAIL / NUDGE

### Device Scan
Scan elements (initial list, may grow):
- Firewall enabled
- FileVault / BitLocker enabled
- Automatic OS updates enabled
- Screen saver idle wait time vs policy threshold

**Result logic per scan element:**
| Device State | Policy Setting | Displayed Result |
|---|---|---|
| OK | Any | PASS (green ✓) |
| NOT OK | FAIL | FAIL (red ✗) |
| NOT OK | NUDGE | WARNING (yellow ⚠) |
| NOT OK | PASS | PASS (green ✓) |

### Auto-Start
- App auto-starts on system login/startup (always on, not user-configurable)
- On start, app immediately shows its window and begins running the scan
- Implementation: LaunchAgent plist (Mac), startup registry or Task Scheduler (Windows)

### Scheduling
- Scan runs on system start
- Scan runs every 24 hours (interval driven by `ScanIntervalHours` in policy, default 24)
- App lives in system tray (Windows) / menu bar (Mac) between scans

### Auto-Updates
- Updates hosted on GitHub releases
- App prompts user when a new version is available
- User confirms → update downloaded and installed
- Detailed update check schedule and UX flow to be defined at implementation
- Tool: electron-updater (part of electron-builder ecosystem)
- Code signing will be implemented for both Mac and Windows (required for Mac auto-updates)

### Results UI
- Full window UI showing per-element scan results with colour-coded status
- Accessible via tray/menu bar icon click

### Reporting
- After each scan, results are sent to backend API
- Submission status shown inline to user:
  - Attempt 1: "Submitting results..."
  - Attempt 2+: "Submitting results (attempt N of M)..."
  - All attempts exhausted: "Results could not be submitted. Please check your connection." (user dismissible)
- Retry behaviour is configurable (delay and max attempts stored in settings file)
- Default: 3 retries, 30 second delay between attempts
- Scan results are always shown to user regardless of submission outcome

### Offline Behaviour
- If no internet connection when scan is triggered, show a clear message to the user and block the scan
- Scan results are not shown when offline (no policy available to evaluate against)
- **Future improvement:** give user option to run scan anyway (view device status without policy evaluation) and submit results once back online

## Current Status
- [ ] Planning phase — tech stack and architecture to be decided

## Open Decisions
- API contract (policy fetch, result submission) — JSON sample to be provided by user
- Full list of scan elements beyond initial set — TBD
- Settings file format and location — TBD
