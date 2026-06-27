# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇷🇺 [Русская версия](README_RU.md)

A native SMS panel for Home Assistant — chat-style messaging, voice calls, phonebook and modem monitoring. Works with any [gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) compatible gateway.

<p align="center">
  <img src="screenshots/desktop.jpg" alt="Desktop view" width="70%"><br>
  <sub>Desktop — chat list, conversation thread, send box</sub>
</p>

---

## Features

### 💬 Messaging
- Chat-style threads — all messages from one sender in one conversation
- Send SMS from any chat or start a new one with the `+` button
- Character counter with GSM limits (160 latin / 70 cyrillic), shows SMS parts count
- Search by phone number or message text
- **Long press** on a message (mobile) or **right click** (desktop) — copy, star ⭐, delete
- **Swipe actions** (mobile ≤580px) — swipe left: mute / delete, swipe right: mark as read / pin
- **Star filter** — button in chat header to show only starred messages

### 📞 Calls
- Outgoing voice calls via AT interface (modems with multiple serial ports, e.g. Huawei)
- `sms_gammu_viewer.call` / `sms_gammu_viewer.hangup` services for automations
- **Call entities** — `cover`/`button` entities that dial a fixed number, for gates and intercoms

### 📇 Contacts
- Phonebook — contact names shown in chat list, call history and chat header
- **Pin conversations** — pinned chats stay at the top; hover button on desktop, swipe on mobile
- **Mute** — disable push notifications per contact, messages still saved

### 📡 Modem & Monitoring
- Modem status page — signal, network, SIM, memory, firmware, IMEI
- Storage block — database size and total message count, with a clear-all button
- Automatic modem recovery — resets after repeated failures with a live warning in status bar
- Instant status on page load — cached response, spinner while refreshing

### 🏠 HA Integration
- Push notifications on new SMS with tap-to-open (iOS & Android), grouped by sender
- English / Russian UI, switchable independently of HA language

### 📱 Mobile UI
- Rounded chat bubbles with border, no dividers
- Scroll padding so last chat is never hidden behind FABs
- Swipe gestures from edge only (40px) to avoid accidental triggers
- Optimistic UI — pin, mute, read apply instantly without waiting for server

---

## Requirements

- Home Assistant 2024.3+
- [gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) running and accessible over HTTP
- USB GSM modem supported by Gammu
- For push notifications: [Home Assistant Companion](https://companion.home-assistant.io/) app

---

## Installation

### HACS (recommended)
1. Add this repo as a **Custom Repository** in HACS → Integrations
2. Install **SMS Gammu Viewer**
3. Restart Home Assistant
4. Settings → Integrations → Add → **SMS Gammu Viewer**

### Manual
```bash
cp -r custom_components/sms_gammu_viewer /config/custom_components/
```
Restart Home Assistant, then add the integration.

---

## Configuration

| Field | Description |
|-------|-------------|
| Host | gammu-gateway IP/hostname |
| Port | gammu-gateway port (default 5000) |
| Username / Password | HTTP Basic Auth credentials |
| Poll interval | How often to check for new SMS (seconds) |
| Call device | Serial device for AT commands (optional) |

---

## Sensors

| Entity | Description | Update |
|--------|-------------|--------|
| `sensor.sms_unread_count` | Number of unread messages | On new SMS |
| `sensor.sms_last_sms_number` | Sender of last received SMS | On new SMS |
| `sensor.sms_last_sms_text` | Text of last received SMS | On new SMS |
| `sensor.signal_quality` | Modem signal strength, % | Every 10s |
| `sensor.network_operator` | Current network name (Beeline, MTS…) | Every 10s |

---

## Sidebar Unread Badge (via custom-sidebar)

Home Assistant doesn't natively support notification badges on sidebar icons. You can add one using the [custom-sidebar](https://github.com/elchininet/custom-sidebar) HACS frontend plugin.

> ⚠️ **Important:** once you define any item in custom-sidebar config, it takes over sidebar ordering and you lose the ability to reorder via HA UI. You'll need to define all items manually to preserve order.

**1. Install custom-sidebar** via HACS → Frontend.

**2. Add to `configuration.yaml`:**
```yaml
frontend:
  extra_module_url:
    - /hacsfiles/custom-sidebar/custom-sidebar-plugin.js
```

**3. Create `/config/www/custom-sidebar-config.yaml`:**
```yaml
order:
  - item: /sms-viewer
    match: href
    notification: |
      [[[
        const count = parseInt(states['sensor.sms_unread_count']?.state) || 0;
        return count > 0 ? String(count) : '';
      ]]]
```

> To find the exact `href` of your SMS panel, add `?cs_debug` to your HA URL and check the browser console → `custom-sidebar debug: Top Native sidebar items`.

**4. Restart Home Assistant.**

---

## Changelog

See [Releases](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases).

---

## Credits

Built on top of [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway). Inspired by the need to have a proper SMS interface inside Home Assistant without external apps.
