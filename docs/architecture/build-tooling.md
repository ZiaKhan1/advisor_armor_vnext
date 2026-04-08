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
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "dist": "electron-vite build && electron-builder"
  }
}
```

Additional scripts are fine for mock mode, platform-specific packaging, or CI, but the core workflow should stay anchored to these commands.

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
