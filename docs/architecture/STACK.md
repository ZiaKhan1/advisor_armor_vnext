---
status: active
audience: both
created: 2026-04-05
---

# Tech Stack

## Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type safety across all three Electron entry points |
| Renderer Framework | React | Widely adopted, good ecosystem for component-based UI |
| Bundler | Manual Vite | Own the build config entirely — no third-party abstraction dependency. electron-vite (alex8088/electron-vite) used as reference for patterns and ideas. |
| Packaging / Distribution | electron-builder | Mature, flexible, strong Mac + Windows support, handles code signing and auto-updates |
| Auto-Updates | electron-updater | Built by electron-builder team, native GitHub releases support, handles Mac + Windows update mechanisms, supports differential updates |
| Logging | winston + winston-daily-rotate-file | Runs in main process; renderer logs routed via IPC. Strong community backing, flexible, battle-tested. See `logging.md` for full rules. |
| Linting | ESLint + @typescript-eslint/recommended + eslint-plugin-react + eslint-plugin-react-hooks | TypeScript and React official/standard rule sets. See `code-quality.md`. |
| Formatting | Prettier | Format on save (VSCode) + pre-commit hook. See `code-quality.md` for config. |
| Pre-commit | husky + lint-staged | Runs lint + format check on staged files only. Fast (~1-2 seconds per commit). |
| Styling | Tailwind CSS + shadcn/ui | Tailwind for layout and custom styling; shadcn/ui for Accordion, Card, Button, Dialog, Tabs, Badge components. See `docs/features/ui.md`. |
| State Management | React Context + useReducer | Lightweight state footprint — no dedicated library needed. Sufficient for: onboarding state, scan results, policy, settings. Migrate to Zustand later if needed. |
| Unit Testing | Vitest | Same toolchain as Vite, fast, TypeScript out of the box, Jest-compatible API |
| Component Testing | React Testing Library + Vitest | Tests UI the way a user interacts with it, same test runner as unit tests |
| E2E Testing | Playwright | Best maintained E2E tool with official Electron support |

## Build Config Notes
- Three separate Vite configs: `vite.config.main.ts`, `vite.config.preload.ts`, `vite.config.renderer.ts`
- Main and preload target Node/CJS; renderer targets browser
- Dev bootstrap script sequences renderer dev server, main/preload builds, and Electron launch
- Auto-restart on main/preload changes via chokidar (not true HMR — same behaviour as electron-vite)
- Renderer gets full Vite HMR in development

## Rejected Options
| Option | Reason rejected |
|---|---|
| electron-vite | Single-person project — bus factor risk for a production app |
| electron-forge | Bundles build + packaging into one opinionated tool; electron-builder is more flexible for packaging |
| electron-forge + electron-builder | Not designed to work together — creates more friction than value |
| Manual Webpack | Heavier and slower than Vite with no meaningful benefit for this project |
