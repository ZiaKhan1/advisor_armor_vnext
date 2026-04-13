---
status: active
audience: both
created: 2026-04-06
deprecated: ~
---

# UI Specification

## Stack

- **Tailwind CSS** — layout, spacing, custom styling
- **shadcn/ui** — component library built on Radix UI primitives

## Themes

- **Onboarding screens** — dark background, white text, centered layout
- **Main app** — light background, standard contrast

---

## Screens

### 1. Login — Email Entry

- Dark background
- Centered: logo (circular), app name, email input, Login button
- On submit: validate email format client-side first
- Button disabled + status text "Validating email address..." while API call is in progress

### 2. Login — OTP Entry

- Dark background
- Centered: logo, app name, verification code input, instructional text, Verify button
- Input: numeric, 4 digits max
- Button disabled + status text "Validating code..." while API call is in progress
- Instructional text: "Please enter the latest verification code sent to your email"

### 3. Loading

- White background
- Centered spinner
- Shown after login while policy is fetched and initial scan runs

### 4. Main — Scan Results

The primary screen. Shown after scan completes and on tray icon click.

#### Nav Bar

- Sticky top bar; remains visible while the results page scrolls
- Lighter blue background, white text
- Four tabs: **Scan** | **Training** | **Report** | **News**
- Scan tab active by default; underlined when active
- `Training`, `Report`, and `News` are placeholder panels in v1 and may show simple "Coming soon" content

#### Device Header

- Compact white card below the nav bar
- Collapsed by default
- Single-row summary:
  - Company name
  - User email
  - Overall status pill
  - Outline chevron toggle

#### Device Info Panel (collapsible)

Shown when header arrow is toggled:

- Manufacturer
- Platform
- Last scanned timestamp

#### Overall Status Summary

- No standalone banner in the current layout
- A compact inline summary appears below the policy heading:
  - **Needs attention** for FAIL
  - **Has recommendations** for NUDGE
  - **Properly configured** for PASS
- Summary text: "Review the policy items below for details and next steps."

#### Scan Element List

- Section heading: "[Company Name] Cybersecurity Policy"
- Each element is an accordion row:
  - Status icon (green ✓ / red ✗ / yellow !) + element name + detail text + outline chevron
  - Collapsed by default
  - Expanded: description text + fix instructions + relevant data (e.g. version comparison table)
  - Fix instructions are hardcoded per element per platform (Mac/Windows)
  - Instructions may include clickable links (e.g. to System Settings, App Store)

Scan elements (in order):

1. System Updates
2. Firewall
3. Disk Encryption
4. Screen Idle
5. Screen Lock
6. Automatic Updates
7. Remote Login
8. Active Wi-Fi Network
9. Known Wi-Fi Networks
10. Network ID
11. Applications

#### Footer

- Fixed bottom bar; remains visible while the results page scrolls
- Last scanned timestamp on the left
- **RESCAN** and **LOG OUT** buttons on the right
- Main content includes bottom padding so the footer does not cover the final scan rows

#### Logout Confirmation Dialog

- Modal overlay on main screen
- Warning icon
- Message: "Are you sure you want to log out? Once logged out, you will need to re-enter your email address and verify it via the one-time code we send to your email to log back in."
- Buttons: Cancel | Logout

---

## Tray / Context Menu

Right-click on tray icon:

- Show AdvisorArmor
- Rescan
- Check for Update
- **Help** (submenu):
  - Email Support — opens `config.supportEmail`
  - Troubleshooting — opens `config.troubleshootingUrl`
  - App version (disabled label)
  - Copy Debug Info — disabled in v1
- Quit

---

## shadcn/ui Component Map

| UI Element                                           | shadcn/ui Component       |
| ---------------------------------------------------- | ------------------------- |
| Scan element list                                    | Accordion                 |
| Device header, device info panel, version comparison | Card                      |
| Login / Verify / Rescan / Logout buttons             | Button                    |
| Logout confirmation                                  | Dialog                    |
| Scan / Training / Report / News                      | Tabs                      |
| PASS / FAIL / NUDGE status indicators                | Badge (custom colours)    |
| Loading spinner                                      | custom or shadcn Skeleton |
