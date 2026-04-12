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
| Bundler | electron-vite | Established Electron + Vite workflow with lower custom build-tooling overhead than a manual setup. See `docs/architecture/build-tooling.md`. |
| Packaging / Distribution | electron-builder | Mature, flexible, strong Mac + Windows support, handles code signing and auto-updates |
| Auto-Updates | electron-updater | Built by electron-builder team, native GitHub releases support, handles Mac + Windows update mechanisms, supports differential updates |
| Logging | electron-log | Electron-native logging with built-in file and console transports, minimal setup, and straightforward main/renderer support. See `logging.md` for full rules. |
| Linting | ESLint + @typescript-eslint/recommended + eslint-plugin-react + eslint-plugin-react-hooks | TypeScript and React official/standard rule sets. See `code-quality.md`. |
| Formatting | Prettier | Format on save (VSCode) + pre-commit hook. See `code-quality.md` for config. |
| Pre-commit | husky + lint-staged | Runs lint + format check on staged files only. Fast (~1-2 seconds per commit). |
| Styling | Tailwind CSS + shadcn/ui | Tailwind for layout and custom styling; shadcn/ui for Accordion, Card, Button, Dialog, Tabs, Badge components. See `docs/features/ui.md`. |
| State Management | React Context + useReducer | Lightweight state footprint — no dedicated library needed. Sufficient for: onboarding state, scan results, policy, settings. Migrate to Zustand later if needed. |
| Unit Testing | Vitest | Same toolchain as Vite, fast, TypeScript out of the box, Jest-compatible API |
| UI Testing | React Testing Library + Vitest | Tests renderer behaviour the way a user interacts with it, using the same runner as unit tests |
| Network Mocking | MSW | Cleaner HTTP mocking for renderer and service-layer tests than ad hoc fetch stubs. Keeps backend contract tests realistic. |
| E2E Testing | Playwright | Best maintained E2E tool with official Electron support |
| IPC / Scan Test Strategy | Thin custom fakes + fixtures | Keep IPC tests explicit in-process. Test OS scan logic mostly through command-output fixtures and parser tests, not real machine settings in CI. See `docs/architecture/testing.md`. |

## Build Config Notes
- electron-vite workflow guidance is documented in `docs/architecture/build-tooling.md`
- testing strategy guidance is documented in `docs/architecture/testing.md`
- Use one `electron.vite.config.ts` with explicit `main`, `preload`, and `renderer` sections
- electron-vite manages the renderer dev server and Electron dev workflow
- Renderer gets full Vite HMR in development
- Main and preload follow electron-vite's restart flow
- electron-builder remains responsible for packaging, signing, and publishing

## Rejected Options
| Option | Reason rejected |
|---|---|
| electron-forge | Bundles build + packaging into one opinionated tool; electron-builder is more flexible for packaging |
| electron-forge + electron-builder | Not designed to work together — creates more friction than value |
| Manual Vite | Viable fallback, but higher custom maintenance cost than `electron-vite` for the same app structure |
| Manual Webpack | Heavier and slower than Vite with no meaningful benefit for this project |
