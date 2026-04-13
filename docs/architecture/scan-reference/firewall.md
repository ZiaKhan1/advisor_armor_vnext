---
status: active
audience: both
created: 2026-04-12
---

# Firewall Scan Reference

This document records the product reference behavior for the first real scan
element implementation. The pasted reference screenshots showed the firewall
row expanded for macOS and Windows in both enabled and disabled states.

Image files can be stored under:

```text
docs/architecture/scan-reference/images/firewall/
```

Suggested filenames:

- `mac-firewall-disabled-nudge.png`
- `mac-firewall-enabled-pass.png`
- `windows-firewall-disabled-nudge-or-fail.png`
- `windows-firewall-enabled-pass.png`

## Scope

- Scan element: Firewall
- Platforms: macOS and Windows
- Device read result: `true`, `false`, or `null`
- Policy evaluation: existing standard boolean logic
- `true` always evaluates to `PASS`
- `false` evaluates according to policy: `PASS`, `NUDGE`, or `FAIL`
- `null` evaluates to `PASS` because the setting could not be determined

The OS-specific implementation should only read the device state. It should not
decide policy status or user-facing wording.

## macOS

### Enabled

- Status: `PASS`
- Detail: `The macOS firewall is turned on.`
- Recommendation: `No action required.`

### Disabled, Policy NUDGE

- Status: `NUDGE`
- Detail: `The macOS firewall is turned off. Enabling it helps protect this device from unwanted network connections, especially on public or unsecured Wi-Fi networks.`
- Recommendation: `Open System Settings > Network > Firewall and turn Firewall on.`

### Disabled, Policy FAIL

- Status: `FAIL`
- Detail: `The macOS firewall is turned off. This device does not meet your organisation's firewall policy.`
- Recommendation: `Open System Settings > Network > Firewall and turn Firewall on.`

### Candidate Command

```bash
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

Expected parser behavior:

- Output containing `enabled` or `on` means `true`
- Output containing `disabled` or `off` means `false`
- Unknown output or command failure means `null`

## Windows

### Enabled

- Status: `PASS`
- Detail: `Windows Defender Firewall is turned on for the required network profiles.`
- Recommendation: `No action required.`

### Disabled, Policy NUDGE

- Status: `NUDGE`
- Detail: `One or more Windows Defender Firewall profiles appear to be turned off. The firewall helps protect this device from unwanted network connections, especially on public or unsecured networks.`
- Recommendation: `Open Windows Security > Firewall & network protection and turn firewall on for the required profiles.`

### Disabled, Policy FAIL

- Status: `FAIL`
- Detail: `One or more Windows Defender Firewall profiles appear to be turned off. This device does not meet your organisation's firewall policy.`
- Recommendation: `Open Windows Security > Firewall & network protection and turn firewall on for the required profiles.`

### Candidate Command

```powershell
Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json
```

Expected parser behavior:

- All required profiles enabled means `true`
- Any required profile disabled means `false`
- Unknown output or command failure means `null`

## UI Notes

The scan list should keep the collapsed row compact. Longer explanatory text
belongs in the expanded detail area. The screenshots use icons that indicate
status, but the implementation does not need to match those icons exactly.

The wording should be consistent by platform, but not identical between macOS
and Windows because the settings locations and platform terminology differ.
