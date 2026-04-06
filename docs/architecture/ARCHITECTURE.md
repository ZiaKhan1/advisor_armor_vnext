---
status: active
audience: both
created: 2026-04-05
---

# Architecture

## Overview
Advisor Armor is a standard Electron application with three layers: main process, preload bridge, and renderer. The main process owns all privileged operations (OS API calls, scheduling, file I/O, backend API calls). The renderer displays scan results. A preload script exposes a controlled IPC surface between the two.

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
| Concern | Mac | Windows |
|---|---|---|
| Tray presence | Menu bar icon | System tray icon |
| Firewall check | `socketfilterfw` / `pfctl` | Windows Firewall API |
| Disk encryption | FileVault (`fdesetup`) | BitLocker (`manage-bde`) |
| Auto-updates check | Software Update preference | Windows Update settings |
| Screen saver idle | `com.apple.screensaver` defaults | Registry / Group Policy |
| Auto-start on login | LaunchAgent plist | Windows startup registry / Task Scheduler |

## Auto-Start
- Always enabled — not user-configurable
- On launch: app window opens immediately and scan begins
- Mac: registered as LaunchAgent so it starts on user login
- Windows: registered via startup registry key or Task Scheduler

## Auto-Updates
- Hosted on GitHub releases
- Handled by `electron-updater` (electron-builder ecosystem)
- Flow: app detects new version → prompts user → user confirms → download + install
- Code signing required on both platforms (mandatory for Mac auto-updates, strongly recommended for Windows)
- Detailed update check schedule TBD at implementation

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
- TBD: offline behaviour when API is unreachable
