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
- Blue background, white text
- Four tabs: **Scan** | **Training** | **Report** | **News**
- Scan tab active by default; underlined when active
- `Training`, `Report`, and `News` are placeholder panels in v1 and may show simple "Coming soon" content

#### Device Header
- Light grey background bar
- Device name (left) — e.g. "Zia's MacBook Pro"
- Toggle arrow (right) — expands/collapses device info panel

#### Device Info Panel (collapsible)
Shown when header arrow is toggled:
- Email, Manufacturer, Model, Platform, OS Version, Name, Serial, UDID, Status
- Collapsed by default

#### Overall Status Banner
- Card below header
- Green checkmark + "This device is properly configured" when all PASS
- Red/yellow variant for FAIL/NUDGE overall status

#### Scan Element List
- Section heading: "[Company Name] Cybersecurity Policy"
- Each element is an accordion row:
  - Status icon (green ✓ / red ✗ / yellow ⚠) + element name + expand arrow (◄/▼)
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
- Last scanned timestamp + scan duration (e.g. "Last scanned 2 hours ago (8.81 seconds)")
- Fixed bottom bar: **RESCAN** button (centre) | **LOG OUT** button (right)

#### Logout Confirmation Dialog
- Modal overlay on main screen
- Warning icon
- Message: "Are you sure you want to log out? Once logged out, you will need to re-enter your email address and verify it via the one-time code we send to your email to log back in."
- Buttons: Cancel | Logout

---

## Tray / Context Menu

Right-click on tray icon:
- Copy (⌘C)
- Check for Update
- **Help** (submenu):
  - Email Support — opens `config.supportEmail`
  - Troubleshooting — opens `config.troubleshootingUrl`
  - App version (disabled label)
  - Copy Debug Info — copies device + scan info to clipboard
- Quit (⌘Q)

---

## shadcn/ui Component Map

| UI Element | shadcn/ui Component |
|---|---|
| Scan element list | Accordion |
| Overall status banner, device info panel, version comparison | Card |
| Login / Verify / Rescan / Logout buttons | Button |
| Logout confirmation | Dialog |
| Scan / Training / Report / News | Tabs |
| PASS / FAIL / NUDGE status indicators | Badge (custom colours) |
| Loading spinner | custom or shadcn Skeleton |
