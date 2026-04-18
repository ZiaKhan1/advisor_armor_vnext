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

## Product Rule

A currently connected WiFi network is considered insecure if it does not require
a password, uses obsolete WiFi security, or allows legacy insecure modes.

The backend `ActiveWifiNetwork` policy controls the displayed result when the
network is insecure:

| Device classification | Policy value | Displayed result |
| --------------------- | ------------ | ---------------- |
| Secure                | Any          | PASS             |
| Insecure              | PASS         | PASS             |
| Insecure              | NUDGE        | NUDGE            |
| Insecure              | FAIL         | FAIL             |
| Unknown               | Any          | PASS             |

Unknown means the app could not determine the WiFi security state. Unknown does
not penalise the user.

## macOS Data Source

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
| `.OWE`                |             14 | Opportunistic Wireless Encryption / Enhanced Open   | Insecure       | Current WiFi uses Enhanced Open, which does not require a password. |
| `.oweTransition`      |             15 | OWE Transition                                      | Insecure       | Current WiFi allows a no-password connection mode.                  |
| `.unknown`            | `NSIntegerMax` | Unknown security type                               | Unknown        | Current WiFi security could not be determined.                      |

## UI Copy Guidance

Show the detected security mode when available, and explain why a non-secure
network is marked as an issue.

Recommended detail text examples:

- Secure: `Current WiFi uses a modern security mode: WPA2 Personal.`
- No password: `Current WiFi does not require a password. Use a password-protected WPA2 or WPA3 network.`
- Enhanced Open: `Current WiFi uses Enhanced Open, which does not require a password. Use a password-protected WPA2 or WPA3 network.`
- OWE Transition: `Current WiFi allows a no-password connection mode. Use a password-protected WPA2 or WPA3 network.`
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

## Implementation Rule

The Swift helper must not emit PASS, NUDGE, or FAIL. It should emit only
observed WiFi facts. The scan layer maps those facts to secure, insecure, or
unknown, and then applies `ActiveWifiNetwork` policy.
