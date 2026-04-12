---
status: active
audience: both
created: 2026-04-05
---

# Architecture

## Overview

DeviceWatch is a standard Electron application with three layers: main process, preload bridge, and renderer. The main process owns all privileged operations (OS API calls, scheduling, file I/O, backend API calls). The renderer displays scan results. A preload script exposes a controlled IPC surface between the two.

## Process Model

### Main Process

Responsible for:

- App lifecycle (auto-start on login, tray/menu bar icon)
- Reading local settings file (stored user email, preferences)
- Fetching policy from backend API
- Running device scans via OS-level APIs (different implementation per platform)
- Scheduling scans (on startup + every 24 hours)
- Submitting scan results to backend API
- Opening / closing the renderer window

### Preload Script

- Exposes a typed IPC bridge (contextBridge) to the renderer
- Renderer never has direct access to Node.js or Electron APIs

### Renderer Process

- Displays scan results UI (per-element PASS / FAIL / NUDGE)
- Triggered by main process after scan completes
- Accessible on demand via tray icon click

## Platform Differences

| Concern             | Mac                              | Windows                  |
| ------------------- | -------------------------------- | ------------------------ |
| Tray presence       | Menu bar icon                    | System tray icon         |
| Firewall check      | `socketfilterfw` / `pfctl`       | Windows Firewall API     |
| Disk encryption     | FileVault (`fdesetup`)           | BitLocker (`manage-bde`) |
| Auto-updates check  | Software Update preference       | Windows Update settings  |
| Screen saver idle   | `com.apple.screensaver` defaults | Registry / Group Policy  |
| Auto-start on login | Electron login item API          | Electron login item API  |

## Auto-Start

- Always enabled — not user-configurable
- On launch: app window opens immediately, update checks run, then the scan flow begins
- v1 implementation uses Electron's built-in login item API (`app.setLoginItemSettings`) on both platforms

## Auto-Updates

- Hosted on GitHub releases
- Handled by `electron-updater` (electron-builder ecosystem)
- Code signing required on both platforms (mandatory for Mac, strongly recommended for Windows)
- `autoDownload` is disabled — user must confirm before download starts

### Check Schedule

- On launch — check immediately after startup
- Regular interval — default 24 hours, manual configuration can be added later if needed
- Manual — "Check for Update" in tray menu — shows dialogs

### UX Flow

1. Update available → dialog: "A new version is available, download now?" → Yes / No
2. User confirms → download starts → progress shown in renderer UI
3. Download complete → dialog: "Update downloaded, app will restart" → OK → quit and install
4. No update / error during silent check → no dialog, errors logged to file

## Data Flow

```
[Device OS APIs]
      │
      ▼
[Main Process — Scan Engine]
      │                    │
      ▼                    ▼
[Backend API]        [Renderer UI]
(report results)     (show results)
      ▲
      │
[Backend API]
(fetch policy)
```

## Key Design Decisions

- All OS API calls live in main process — renderer is sandboxed
- Platform-specific scan implementations abstracted behind a common interface
- Settings stored in Electron's `app.getPath('userData')` directory
- Each scan fetches the latest policy before evaluation
- If policy fetch fails because the device is offline, show an error in the main window and block the scan
- v1 does not run scans against a cached policy
