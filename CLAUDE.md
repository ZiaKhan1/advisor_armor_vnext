# Claude Code Context

This file is auto-loaded by Claude Code at the start of every session.
Use it as the entry point to all project context.

## Project
DeviceWatch — an Electron desktop compliance monitoring application (Mac + Windows).
See `docs/planning/PLAN.md` for current status and active goals.

## Docs Structure
```
docs/
├── architecture/    # Permanent — decisions that outlive the project
│   ├── ARCHITECTURE.md
│   └── STACK.md
├── features/        # Permanent — finalized feature specs
└── planning/        # Temporary — active planning, archived post-launch
    └── PLAN.md
```

## Key Files for AI Context
- Current plan & status → `docs/planning/PLAN.md`
- Resolved planning decisions → `docs/planning/DECISIONS.md`
- System design & data flow → `docs/architecture/ARCHITECTURE.md`
- Tech stack decisions → `docs/architecture/STACK.md`
- electron-vite dev workflow & build tooling → `docs/architecture/build-tooling.md`
- API contract & policy JSON → `docs/architecture/api-contract.md`
- Scan elements & result logic → `docs/architecture/scan-logic.md`
- Logging rules → `docs/architecture/logging.md`
- Code quality (ESLint, Prettier, husky) → `docs/architecture/code-quality.md`
- Testing strategy → `docs/architecture/testing.md`
- White-labelling & mock mode → `docs/architecture/white-labelling.md`
- Local storage & settings files → `docs/architecture/local-storage.md`
- Scan implementation approach → `docs/architecture/scan-implementation.md`
- UI screens, components & tray menu → `docs/features/ui.md`
- Other feature specs → `docs/features/`

## Session Notes
- Read `docs/planning/PLAN.md` first when resuming work
- Check relevant `docs/features/` file when working on a specific area
