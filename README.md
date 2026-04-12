# DeviceWatch

Electron desktop client for AdvisorArmor / DeviceWatch.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run package`
- `npm run package:smoke`
- `npm run dist`

## Packaging

- `npm run package` builds the app and creates an unpacked app bundle. Use this as a fast packaging smoke test.
- `npm run package:smoke` creates an unpacked app bundle from an existing `out/` build.
- `npm run dist` builds the app and creates installer artifacts for the current platform.
- `npm run dist:mac`, `npm run dist:win`, and `npm run dist:linux` create platform-specific installer artifacts.
- `npm run dist:mac:universal` creates the macOS distribution artifact for both Intel Mac and Apple Silicon.

Packaged output is written to `release/`.

For macOS distribution, build and publish the universal artifact with `npm run dist:mac:universal`. Current-architecture macOS builds are acceptable for local testing, but distribution builds should be universal so the same installer supports both `x64` Intel Macs and `arm64` Apple Silicon Macs.
