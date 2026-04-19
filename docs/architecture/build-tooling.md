---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# Build Tooling

## Decision

Use the `electron-vite` package for Electron development workflow and build tooling.

This keeps the setup smaller than a hand-rolled multi-config Vite pipeline while still staying close to standard Electron and Vite concepts. The project will rely on `electron-vite` for development orchestration and production bundling, and continue using `electron-builder` for packaging, code signing, and auto-update distribution.

## Why `electron-vite`

- reduces custom build-script maintenance
- provides established Electron + Vite development patterns
- supports separate `main`, `preload`, and `renderer` entry points cleanly
- keeps renderer HMR and Electron development workflow integrated
- lowers the amount of custom restart/watch logic the project needs to own

## Role Split

- `electron-vite`: development workflow and app bundling
- `electron-builder`: installer packaging, signing, publishing, and auto-update artifacts

`electron-vite` should not replace `electron-builder` in this project.

## Expected Project Structure

Keep the structure simple and aligned with `electron-vite` conventions:

```text
electron/
  main/
    index.ts
  preload/
    index.ts
src/
  renderer/
    src/
      main.tsx
      App.tsx
electron.vite.config.ts
electron-builder.yml
tsconfig.json
```

The exact folder names can vary slightly, but the important point is that `main`, `preload`, and `renderer` remain clearly separated.

## Minimum Responsibilities

### 1. Build the Three Targets

`electron-vite` should manage builds for:

- Electron main process
- Electron preload script
- renderer application

The configuration should keep each target explicit rather than hiding them behind excessive abstraction.

### 2. Run Development Mode

Development mode should use the standard `electron-vite` flow:

- start renderer dev server
- build and watch `main`
- build and watch `preload`
- launch Electron automatically
- reload or restart as appropriate when files change

### 3. Keep Renderer HMR, Restart Main/Preload

- renderer uses normal Vite HMR
- `main` and `preload` should follow the `electron-vite` restart flow

The project should rely on the package defaults where possible rather than rebuilding this logic manually.

### 3.1 Renderer DevTools in Development

In development mode only, the renderer window exposes Chromium DevTools through the renderer context menu:

- right-click inside the app window
- choose **Toggle Developer Tools**
- use the normal Chromium panels such as Console, Elements, Sources, Application, and Network

This is enabled only for unpackaged/dev runs. Production builds disable renderer DevTools.

Renderer DevTools show renderer-process activity. Main-process work, including backend API calls made from `electron/main/backend.ts`, scan execution, updater logs, and filesystem access, is not expected to appear in the renderer DevTools Network panel. Those operations should be inspected through main-process logs and external proxy/debug tools when needed.

### 3.2 Future: React DevTools Extension

React Developer Tools inside Electron's Chromium DevTools is useful for inspecting renderer component state, props, hooks, and profiler data. The preferred future direction is to evaluate `electron-devtools-installer` as a dev-only helper for installing the React Developer Tools browser extension into Electron.

This is intentionally not implemented yet. If revisited, keep it constrained:

- it should run only in unpackaged development mode
- `npm run dev` should remain the only command needed
- it should not use the standalone `react-devtools` process
- installation failures should log a warning and must not block app startup
- verify that the DevTools **Components** and **Profiler** tabs appear, not just that the extension install logs success

### 4. Produce Stable Outputs for Packaging

Bundled outputs should be predictable and easy for `electron-builder` to consume.

Suggested layout:

```text
out/
  main/
  preload/
  renderer/
```

If `electron-vite` defaults differ, the project may use those defaults as long as the `electron-builder` config stays clear and stable.

### 5. Keep Dev and Prod Entry Resolution Simple

`electron-vite` should handle the development and production loading split:

- development loads the local renderer dev server
- production loads built renderer assets
- preload path stays explicit and controlled

Avoid adding custom environment-dependent entry resolution unless a real requirement appears.

## Recommended Scripts

Keep the scripts small and close to standard `electron-vite` usage:

```json
{
  "scripts": {
    "dev": "node scripts/ensure-native.mjs && electron-vite dev --watch",
    "build:native": "node scripts/ensure-native.mjs --strict",
    "build": "npm run build:native && electron-vite build",
    "preview": "electron-vite preview",
    "package": "npm run build && electron-builder --dir",
    "package:smoke": "npm run build:native && electron-builder --dir",
    "dist": "npm run build && electron-builder",
    "dist:mac:universal": "npm run build && electron-builder --mac --universal"
  }
}
```

Additional scripts are fine for mock mode, platform-specific packaging, or CI, but the core workflow should stay anchored to these commands.

`scripts/ensure-native.mjs` builds native helper binaries that are required by
main-process scan checks. It currently builds the macOS Active WiFi and Known
WiFi helpers from Swift source when running on macOS and skips native work on
other platforms. The generated helper binaries and Swift module caches stay out
of git.

## Installer Workflow

Use `electron-builder` for packaged app and installer outputs:

- `npm run package` creates an unpacked app bundle through `electron-builder --dir`; this is the fastest packaging smoke test.
- `npm run package:smoke` runs the native helper preflight and `electron-builder --dir`; it expects `out/` to already exist. CI uses this after `npm run build`.
- `npm run dist` creates installer artifacts for the current platform.
- `npm run dist:mac`, `npm run dist:win`, and `npm run dist:linux` create platform-specific artifacts when the build host supports that target.
- `npm run dist:mac:universal` creates the macOS distribution artifact for both Intel Mac and Apple Silicon.

The installer output directory is `release/`. Local generated artifacts are ignored by git.

macOS packaging includes the generated Active WiFi and Known WiFi helpers as
extra resources under `native/macos/wifi-active/wifi-active` and
`native/macos/wifi-known/wifi-known`. Release and packaging commands must run
`npm run build` first so the helpers exist before `electron-builder` collects
resources.

macOS installer output should include a `.dmg` for manual install testing and a `.zip` for future auto-update compatibility. Windows should produce an NSIS installer. Local installer builds are unsigned for now so packaging can be tested without depending on developer certificates or keychain state. Signing, notarization, and publishing should be added later once Apple Developer ID, Windows signing certificate, and GitHub release credentials are available.

macOS release distribution should use universal builds so one artifact supports both `x64` Intel Macs and `arm64` Apple Silicon Macs. Current-architecture macOS builds are acceptable for local smoke testing only.

CI should run `npm run package:smoke` after `npm run build` as a packaging smoke test. Full signed installer creation and publishing should remain a release workflow concern rather than a normal push check.

## Future Release Publishing

The normal CI workflow should not publish installer artifacts. It should only validate that the app can build and package.

A separate release workflow should be added later for real distribution. That workflow should run only for explicit release events, such as version tags:

```yaml
on:
  push:
    tags:
      - 'v*'
```

The release workflow should:

- install dependencies with `npm ci`
- run the same validation checks as CI or depend on a passing CI result
- build macOS universal artifacts with `npm run dist:mac:universal`
- sign and notarize macOS artifacts
- run `electron-builder` with publishing enabled, for example `--publish always`
- upload artifacts to GitHub Releases through the configured `publish` provider

The `publish` configuration should be made explicit before enabling release uploads:

```yaml
publish:
  provider: github
  owner: AdvisorArmorApplets
  repo: <release-repository>
```

`electron-builder` uses this configuration plus a GitHub token, usually `GH_TOKEN` or `GITHUB_TOKEN`, to create or update a GitHub Release and upload installer artifacts such as `.dmg`, `.zip`, blockmaps, and update metadata.

`electron-updater` will later use those GitHub Release artifacts and metadata to discover and install app updates.

## Configuration Guidance

Prefer one `electron.vite.config.ts` file with clearly separated sections for:

- `main`
- `preload`
- `renderer`

Keep configuration explicit for:

- path aliases
- externals
- output directories
- environment handling

Do not add a second layer of custom build abstraction on top of `electron-vite`.

## Debugging Principle

Even though `electron-vite` reduces setup code, the project should still keep failures easy to localise.

When something breaks, it should still be traceable to one of:

- Electron main entry
- preload bundle
- renderer bundle
- `electron-vite` configuration
- `electron-builder` packaging config

If the project starts compensating for `electron-vite` with a large custom scripts layer, the setup should be reconsidered.

## What Not to Add Up Front

- custom wrapper framework around `electron-vite`
- duplicate manual watch/restart scripts
- complex generated config layers
- environment handling spread across many files
- packaging logic mixed into dev tooling

## Fallback Principle

If `electron-vite` introduces a blocker that cannot be addressed cleanly through configuration or a small local workaround, the project can fall back to a manual Vite setup later.

That fallback remains viable because the app architecture still uses standard Electron concepts:

- main process
- preload bridge
- renderer app
- `electron-builder` packaging

The tooling choice should not distort the architecture.
