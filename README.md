# Advisor Armor DeviceWatch

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

## Logs

The app uses `electron-log` from the Electron main process. File logs use the
default Electron/electron-log per-app location for the app name
`AdvisorArmor`.

### macOS

Dev mode and installed app:

```text
~/Library/Logs/AdvisorArmor/main.log
```

Example for user `ziakhan`:

```text
/Users/ziakhan/Library/Logs/AdvisorArmor/main.log
```

Here `~` expands to the current user's home directory, for example
`/Users/ziakhan`.

### Windows

Dev mode and installed app:

```text
%USERPROFILE%\AppData\Roaming\AdvisorArmor\logs\main.log
```

Example:

```text
C:\Users\<username>\AppData\Roaming\AdvisorArmor\logs\main.log
```

Dev and installed builds are expected to write to the same log path when they
run under the same OS user and use the same app name. If a log directory is
created by another user, such as `root` or Administrator, the app may fail to
write logs until the directory ownership or permissions are corrected.
