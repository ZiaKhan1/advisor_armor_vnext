---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# Build Tooling

## Decision

Use a minimal manual Vite setup for the Electron app.

This keeps the build system explicit and debuggable while avoiding unnecessary custom tooling. The goal is to own the small amount of wiring required for Electron rather than introducing a larger abstraction layer.

## Scope of "Manual"

Manual does not mean building a custom framework. It means keeping a thin layer that handles:

- separate builds for `main`, `preload`, and `renderer`
- a development bootstrap flow
- Electron restart on `main` or `preload` rebuild
- production build output layout for `electron-builder`
- explicit development vs production entry loading

Anything beyond that should be added only when there is a concrete need.

## Minimal File Layout

```text
electron/
  main.ts
  preload.ts
scripts/
  dev.ts
src/
  renderer/
    main.tsx
    App.tsx
vite.config.main.ts
vite.config.preload.ts
vite.config.renderer.ts
tsconfig.json
tsconfig.main.json
tsconfig.preload.json
tsconfig.renderer.json
electron-builder.yml
```

## Minimum Responsibilities

### 1. Build the Three Targets

- `main` builds for Electron main process runtime
- `preload` builds for Electron preload runtime
- `renderer` builds for the browser runtime

Each target has its own Vite config so entry points, output formats, aliases, and external dependencies stay explicit.

### 2. Run Development Mode

Development mode should:

1. start the renderer Vite dev server
2. build `main` in watch mode
3. build `preload` in watch mode
4. launch Electron after initial builds are ready

### 3. Restart Electron When Needed

- Renderer changes use normal Vite HMR
- `main` and `preload` changes trigger Electron process restart

This should be treated as a simple restart loop, not as true HMR for privileged code.

### 4. Produce Stable Production Outputs

Use fixed output folders so Electron entry paths and `electron-builder` configuration are simple and predictable.

Suggested layout:

```text
dist/
  main/
  preload/
  renderer/
```

### 5. Keep Dev and Prod Entry Resolution Explicit

- In development, the BrowserWindow loads the local renderer dev server URL
- In production, the BrowserWindow loads the built renderer HTML file
- Preload always points to the built preload bundle path

These rules should live in one small helper inside `electron/main.ts` or a nearby utility.

## Recommended Scripts

Keep the script surface area small:

```json
{
  "scripts": {
    "dev": "tsx scripts/dev.ts",
    "build": "npm run build:main && npm run build:preload && npm run build:renderer",
    "build:main": "vite build --config vite.config.main.ts",
    "build:preload": "vite build --config vite.config.preload.ts",
    "build:renderer": "vite build --config vite.config.renderer.ts",
    "dist": "npm run build && electron-builder"
  }
}
```

If watch-mode scripts are split further, keep that internal to `scripts/dev.ts` rather than expanding `package.json` unnecessarily.

## Recommended Dev Bootstrap Behaviour

The dev bootstrap script should do only this:

- start the renderer dev server
- wait until the renderer URL is available
- start `main` and `preload` builds in watch mode
- wait for their first successful build
- launch Electron
- restart Electron when a watched privileged bundle rebuilds successfully
- shut everything down cleanly on exit

Avoid adding environment mutation, code generation, or packaging logic into this script.

## Keep Shared Config Small

Shared Vite config is useful only for:

- path aliases
- common externals
- shared output conventions

Do not force the three targets into a highly abstract shared config if their requirements differ. Small duplication is preferable to clever indirection here.

## Debugging Principle

The main reason to prefer this setup is debuggability.

When something breaks, the failure should be traceable to one of:

- Electron main entry
- preload bundle
- renderer bundle
- dev bootstrap script
- `electron-builder` packaging config

If the setup becomes harder to reason about than that, it is no longer minimal.

## What Not to Build Up Front

- custom plugin framework
- dynamic multi-environment config system
- bespoke HMR layer for `main` or `preload`
- generated build manifests unless a real packaging need appears
- a large `scripts/` toolbox

## Comparison With `electron-vite`

`electron-vite` is a credible and actively used tool, but this project prefers minimal manual Vite because:

- build behavior stays fully explicit
- debugging edge cases is more direct
- there is no extra abstraction layer on the critical path
- migration cost stays low because the setup uses standard Vite and Electron concepts

This does not rule out revisiting `electron-vite` later. If the manual setup grows beyond the boundaries in this document, the project should reconsider whether the custom wiring is still worth owning.
