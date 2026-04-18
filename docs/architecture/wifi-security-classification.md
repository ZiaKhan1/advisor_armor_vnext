---
status: active
audience: both
created: 2026-04-18
deprecated: ~
---

# WiFi Security Classification

## Purpose

This document defines how DeviceWatch classifies WiFi security for scan
evaluation. OS APIs report WiFi facts. DeviceWatch classifies those facts as
secure, insecure, or unknown, then applies backend policy.

Active WiFi Network and Known WiFi Networks must share the same TypeScript
classification logic. Platform read layers and native helpers emit facts only;
they must not decide PASS, NUDGE, or FAIL.

## Product Rule

A WiFi network is considered insecure if it does not require a password, uses
obsolete WiFi security, uses a no-password encrypted mode, or allows legacy
insecure modes.

The backend `ActiveWifiNetwork` and `KnownWifiNetworks` policies control the
displayed result when an evaluated network is insecure:

| Device classification | Policy value | Displayed result |
| --------------------- | ------------ | ---------------- |
| Secure                | Any          | PASS             |
| Insecure              | PASS         | PASS             |
| Insecure              | NUDGE        | NUDGE            |
| Insecure              | FAIL         | FAIL             |
| Unknown               | Any          | PASS             |

Unknown means the app could not determine the WiFi security state. Unknown does
not penalise the user.

For Known WiFi Networks, DeviceWatch evaluates every saved network profile it
can read. If any saved profile is insecure, the device state is NOT OK and the
`KnownWifiNetworks` policy determines PASS, NUDGE, or FAIL. If all readable
profiles are secure, the device state is OK. If saved profiles cannot be read,
the result is unknown and pass-safe.

## macOS Active WiFi Data Source

macOS active WiFi should be read through a bundled Swift helper using CoreWLAN.
The helper should return facts only, not scan results.

Recommended helper output:

```json
{
  "ssid": "Office WiFi",
  "security": "WPA2 Personal",
  "securityRawValue": 4
}
```

TypeScript owns classification and backend policy evaluation.

SSID should be included when available. It may be shown in the scan detail and
logged with the WiFi facts so support can correlate user reports with scan logs.
BSSID should not be collected or logged unless a later investigation requirement
explicitly needs physical access point correlation.

## macOS Known WiFi Data Source

macOS known WiFi profiles should be read through a bundled Swift helper using
CoreWLAN:

- `CWWiFiClient.shared()`
- `client.interface() ?? client.interfaces()?.first`
- `interface.configuration()`
- `configuration.networkProfiles`

Each `CWNetworkProfile` should be emitted as facts:

```json
{
  "knownNetworks": [
    {
      "ssid": "Office WiFi",
      "security": "WPA2 Personal",
      "securityRawValue": 4
    }
  ]
}
```

The helper must include `securityRawValue` because TypeScript classification
should not depend only on human-readable labels.

## macOS CoreWLAN Classification

Apple's `CWSecurity` enum identifies the WiFi security type reported by
CoreWLAN.

| CoreWLAN value        |      Raw value | Meaning                                             | Classification | User-facing reason                                                  |
| --------------------- | -------------: | --------------------------------------------------- | -------------- | ------------------------------------------------------------------- |
| `.none`               |              0 | Open System authentication                          | Insecure       | Current WiFi does not require a password.                           |
| `.WEP`                |              1 | WEP security                                        | Insecure       | Current WiFi uses outdated WEP security.                            |
| `.wpaPersonal`        |              2 | WPA Personal authentication                         | Insecure       | Current WiFi uses outdated WPA security.                            |
| `.wpaPersonalMixed`   |              3 | WPA/WPA2 Personal authentication                    | Insecure       | Current WiFi allows older WPA security.                             |
| `.wpa2Personal`       |              4 | WPA2 Personal authentication                        | Secure         | Current WiFi uses WPA2 security.                                    |
| `.personal`           |              5 | Personal authentication                             | Unknown        | Current WiFi security could not be determined precisely.            |
| `.dynamicWEP`         |              6 | Dynamic WEP security                                | Insecure       | Current WiFi uses outdated WEP security.                            |
| `.wpaEnterprise`      |              7 | WPA Enterprise authentication                       | Insecure       | Current WiFi uses outdated WPA security.                            |
| `.wpaEnterpriseMixed` |              8 | WPA/WPA2 Enterprise authentication                  | Insecure       | Current WiFi allows older WPA security.                             |
| `.wpa2Enterprise`     |              9 | WPA2 Enterprise authentication                      | Secure         | Current WiFi uses WPA2 Enterprise security.                         |
| `.enterprise`         |             10 | Enterprise authentication                           | Unknown        | Current WiFi security could not be determined precisely.            |
| `.wpa3Personal`       |             11 | WPA3 Personal authentication                        | Secure         | Current WiFi uses WPA3 security.                                    |
| `.wpa3Enterprise`     |             12 | WPA3 Enterprise authentication                      | Secure         | Current WiFi uses WPA3 Enterprise security.                         |
| `.wpa3Transition`     |             13 | WPA3 Transition (WPA3/WPA2 Personal) authentication | Secure         | Current WiFi uses WPA3/WPA2 transition security.                    |
| `.OWE`                |             14 | Opportunistic Wireless Encryption / Enhanced Open   | Insecure       | Current WiFi encrypts WiFi traffic but does not require a password. |
| `.oweTransition`      |             15 | OWE Transition                                      | Insecure       | Current WiFi encrypts WiFi traffic but does not require a password. |
| `.unknown`            | `NSIntegerMax` | Unknown security type                               | Unknown        | Current WiFi security could not be determined.                      |

## UI Copy Guidance

Show the detected security mode when available, and explain why a non-secure
network is marked as an issue.

Recommended detail text examples:

- Secure: `Current WiFi uses a modern security mode: WPA2 Personal.`
- No password: `Current WiFi does not require a password. Use a password-protected WPA2 or WPA3 network.`
- OWE / Enhanced Open: `Current WiFi encrypts WiFi traffic but does not require a password. Use a password-protected WPA2 or WPA3 network.`
- WEP: `Current WiFi uses outdated WEP security. Use a WPA2 or WPA3 network.`
- WPA: `Current WiFi uses outdated WPA security. Use a WPA2 or WPA3 network.`
- WPA/WPA2 mixed: `Current WiFi allows older WPA security. Use a WPA2-only, WPA3, or WPA2/WPA3 network.`
- Unknown: `Current WiFi security could not be determined.`

## macOS Lock Icon Note

The macOS WiFi lock icon means the network is not fully open in the basic user
interface. It does not by itself prove that the network satisfies DeviceWatch
policy. For example, WPA/WPA2 mixed networks can still show as protected in
macOS while DeviceWatch classifies them as insecure because they allow older WPA
security.

## Windows Active WiFi Data Source

Windows active WiFi should initially be read with `netsh wlan show interface`
through non-interactive PowerShell. The old app already used this path, and it
normally exposes the active connection's `SSID`, `Authentication`, and `Cipher`
without elevation.

Recommended command shape:

```powershell
$h=@{}
netsh wlan show interface | % {
  $line = $_.Trim()
  if ($line -match "(.+?)\s*:\s*(.+)") {
    $h[$matches[1].Trim()] = $matches[2].Trim()
  }
}
$h | ConvertTo-Json -Depth 3
```

Recommended parsed facts:

```json
{
  "ssid": "Office WiFi",
  "authentication": "WPA2-Personal",
  "cipher": "CCMP"
}
```

SSID should be included when available for the same support/debugging purpose as
macOS. BSSID is not required for Active WiFi Network v1.

If `netsh` parsing proves unreliable in customer environments, move the Windows
read layer to a typed helper that calls the Windows WLAN API directly. Keep the
classification and policy logic in TypeScript.

## Windows Known WiFi Data Source

Windows known WiFi profiles should initially be read with `netsh` through
non-interactive PowerShell. The old app used this approach and it normally works
without elevation.

Recommended command shape:

```powershell
$profiles = netsh wlan show profiles |
  Select-String "All User Profile" |
  % { $_.ToString().Split(":", 2)[1].Trim() }

$out = @()
foreach ($p in $profiles) {
  $details = netsh wlan show profile name="$p"
  $ssidLine = $details | Select-String "SSID name"
  $ssid = if ($ssidLine) {
    $ssidLine.ToString().Split(":", 2)[1].Trim().Trim("`"")
  } else {
    ""
  }

  $authArray = @()
  $authLines = $details | Select-String "Authentication"
  foreach ($line in $authLines) {
    $authArray += $line.ToString().Split(":", 2)[1].Trim().Trim("`"")
  }

  $cipherArray = @()
  $cipherLines = $details | Select-String "Cipher"
  foreach ($line in $cipherLines) {
    $cipherArray += $line.ToString().Split(":", 2)[1].Trim().Trim("`"")
  }

  $out += [pscustomobject]@{
    ProfileName = $p
    SSID = $ssid
    Authentication = $authArray
    Cipher = $cipherArray
  }
}

$out | ConvertTo-Json -Compress -Depth 5
```

Each saved profile may expose multiple authentication or cipher lines. Classify
a profile as insecure if any authentication/cipher value is clearly insecure.
Classify it as secure if at least one modern secure value is present and no
insecure value is present. Otherwise classify it as unknown and do not penalise
the user.

## Windows Classification

Windows exposes security through authentication and cipher values. Microsoft
documents these as `DOT11_AUTH_ALGORITHM` and `DOT11_CIPHER_ALGORITHM` in the
WLAN API. `netsh wlan show interface` presents user-readable versions of the
same concepts.

| Windows value                                                                                                                  | Classification | User-facing reason                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------- |
| Authentication `Open`                                                                                                          | Insecure       | Current WiFi does not require a password.                           |
| Authentication `OWE`                                                                                                           | Insecure       | Current WiFi encrypts WiFi traffic but does not require a password. |
| Authentication `Shared Key`                                                                                                    | Insecure       | Current WiFi uses outdated WEP security.                            |
| Authentication containing `WEP`                                                                                                | Insecure       | Current WiFi uses outdated WEP security.                            |
| Cipher `WEP`, `WEP40`, or `WEP104`                                                                                             | Insecure       | Current WiFi uses outdated WEP security.                            |
| Authentication `WPA`, `WPA-PSK`, `WPA-Personal`, or `WPA-Enterprise`                                                           | Insecure       | Current WiFi uses outdated WPA security.                            |
| Cipher `TKIP`                                                                                                                  | Insecure       | Current WiFi uses a weak security mode.                             |
| Authentication `RSNA`, `RSNA-PSK`, `WPA2-Personal`, or `WPA2-Enterprise` with cipher `CCMP`, `CCMP-256`, `GCMP`, or `GCMP-256` | Secure         | Current WiFi uses WPA2 security.                                    |
| Authentication `WPA3-SAE`, `WPA3-Personal`, `WPA3-Enterprise`, or `WPA3-Enterprise 192-bit`                                    | Secure         | Current WiFi uses WPA3 security.                                    |
| Missing, vendor-specific, or unexpected values                                                                                 | Unknown        | Current WiFi security could not be determined.                      |

Windows output labels may vary by OS version, driver, or localization. Matching
should be case-insensitive and tolerant of common punctuation differences such
as `WPA2-Personal`, `WPA2 Personal`, and `WPA2PSK`.

## Windows UI Copy Guidance

Use the same high-level reason categories as macOS:

- Secure: `Current WiFi uses a modern security mode: WPA2-Personal / CCMP.`
- No password: `Current WiFi does not require a password. Use a password-protected WPA2 or WPA3 network.`
- OWE / Enhanced Open: `Current WiFi encrypts WiFi traffic but does not require a password. Use a password-protected WPA2 or WPA3 network.`
- WEP: `Current WiFi uses outdated WEP security. Use a WPA2 or WPA3 network.`
- WPA or TKIP: `Current WiFi uses a weak security mode. Use a WPA2 or WPA3 network.`
- Unknown: `Current WiFi security could not be determined.`

For a secure active connection, show a short instruction:

`You can see your current WiFi connection by opening WiFi in Settings.`

For a non-secure active connection, use detailed remediation steps:

1. Open `WiFi` in Settings.
2. Click `Show available networks`.
3. Click `Disconnect` to disconnect the current WiFi network.
4. Connect to a secure WiFi network:
   - Select a password-protected WPA2 or WPA3 network from the available WiFi networks list.
   - Enter the network password if prompted.
   - Click `Connect`.

## Known WiFi UI Copy Guidance

Use one consistent user-facing frame:

`Insecure saved WiFi networks`

Do not lead with low-level labels such as OWE, RSNA, TKIP, or AKM in the UI.
Keep those labels in facts and logs. Show friendly per-network reasons:

- Open: `does not require a password`
- OWE / Enhanced Open: `encrypts WiFi traffic but does not require a password`
- WEP: `uses outdated WEP security`
- WPA: `uses outdated WPA security`
- WPA/WPA2 mixed: `allows older WPA security`
- TKIP: `uses weak WiFi security`

Recommended details:

- Pass: `No insecure saved WiFi networks were found on this device.`
- Insecure: `This device remembers one or more insecure WiFi networks.`
- Unknown: `Saved WiFi networks could not be checked.`

When insecure networks are found, list the saved SSIDs with reasons, for
example:

```text
Cafe Guest - does not require a password
Library WiFi - encrypts WiFi traffic but does not require a password
Old Router - uses outdated WPA security
```

macOS remediation steps:

1. Choose `System Settings` from the Apple menu.
2. Select `WiFi` from the sidebar.
3. Click `Advanced` to see the WiFi networks known to your device.
4. Remove each insecure saved network listed below:
   - Click the more button next to the network name.
   - Click `Remove from List`.
   - Click `Remove` or `Forget` if prompted.

Windows remediation steps:

1. Open `WiFi` in Settings.
2. Click `Manage known networks` to see the networks known to this system.
3. Select each insecure saved network listed below.
4. Click `Forget`.

## Implementation Rule

Swift helpers must not emit PASS, NUDGE, or FAIL. They should emit only observed
WiFi facts. Windows read layers follow the same rule. The scan layer maps
observed facts to secure, insecure, or unknown, and then applies
`ActiveWifiNetwork` or `KnownWifiNetworks` policy.

The main process should log observed WiFi facts and the resulting
classification. Log SSID, security/authentication/cipher fields, and the
classification result. For Known WiFi Networks, log the profile count and
per-profile classification. Avoid logging raw command output unless parsing
fails, and keep any raw-output log bounded.
