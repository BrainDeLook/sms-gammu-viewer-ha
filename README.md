# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇷🇺 [Русская версия](README_RU.md)

A native panel for viewing and sending SMS messages directly in Home Assistant. Works with the [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on and any compatible gateway based on [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

After installation, an **SMS** tab appears in the sidebar. Messages are stored in an internal SQLite database and are automatically deleted from the modem after being received.

---


## Features

- 💬 Chat-style view — all SMS from one sender in one thread
- ✍️ **Send SMS** — reply from inside a chat, or start a brand-new conversation via the "New message" button
- 🌐 **Multi-language UI** (English / Russian) — switchable via the 🌐 button in the header, independent of HA's language. Add your own language by dropping a `frontend/locales/{code}.js` file and opening a PR
- 🔢 Unread SMS counter badge on the sidebar icon (`sensor.sms_unread_count`)
- 🔔 Push notifications on new SMS with tap-to-open (iOS & Android)
- 🔄 Auto-refresh — chat updates automatically when new messages arrive (event polling every 4s)
- 📶 Modem status page — signal, operator, IMEI, SIM capacity, modem reset
- 🩺 **Automatic modem recovery** — after 5 consecutive failed polls the integration resets the modem itself (2-minute cooldown between resets), with a live warning in the status bar
- 🗄 Internal SQLite storage — messages persist independently of SIM card memory
- 🧩 Smart multipart SMS assembly — long messages collected in full before saving, including messages split across multiple delivery waves
- 🏷 Alpha-tag sender support — shows names like `Yandex` or bank senders correctly, not just phone numbers
- 🔍 Search by phone number or message text
- 📋 Tap any message to copy its text
- 🗑 Delete individual messages or entire conversations
- ⚙️ Configurable polling interval and notification targets from the HA UI
- 📱 Mobile-friendly: hamburger menu button to open the HA sidebar, back navigation, full-width "New message" button
- 🗓 Date dividers in chat (Today, Yesterday, full date)

---

## Requirements

- Home Assistant 2023.1+
- Running [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on with REST API on port 5000
- For push notifications: [Home Assistant Companion](https://companion.home-assistant.io/) app on your phone

> ⚠️ **Important:** In the sms-gammu-gateway add-on configuration, **disable automatic SMS polling** (`SMS_CHECK_INTERVAL` or equivalent). Otherwise the add-on and this integration will simultaneously read and delete messages from the SIM, causing message loss. SMS Gammu Viewer takes over all polling logic.

---

## Installation

### Via HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Or manually:

1. Open **HACS** in Home Assistant
2. Click ⋮ → **Custom repositories**
3. Paste: `https://github.com/BrainDeLook/sms-gammu-viewer-ha` — Category: **Integration**
4. Find **SMS Gammu Viewer** → **Download**
5. Restart Home Assistant

### Manual installation

1. Download the [latest release](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
2. Copy `custom_components/sms_gammu_viewer/` to `<config>/custom_components/`
3. Restart Home Assistant

---

## Initial Setup

1. Go to **Settings → Devices & Services → + Add Integration**
2. Search for **SMS Gammu Viewer**
3. Fill in the form:

| Field | Description | Example |
|---|---|---|
| **Host** | IP or hostname where the add-on runs | `localhost` or `192.168.1.100` |
| **Port** | REST API port | `5000` |
| **Username** | Add-on login | `admin` |
| **Password** | Add-on password | `password` |

4. Click **Submit** — the integration will verify the connection
5. The **SMS** icon (💬) will appear in the sidebar

---

## Using the panel

- **Open a conversation** — tap any contact in the list
- **Reply** — type in the box at the bottom of an open chat, `Enter` to send, `Shift+Enter` for a new line
- **Start a new conversation** — tap the **"New message"** button at the bottom of the contacts list, enter a number and text
- **Copy a message** — tap its text
- **Delete a message** — hover/tap the 🗑 icon next to it
- **Delete a whole conversation** — tap the trash icon in the chat header
- **Change language** — tap the 🌐 icon in the header
- **View modem status** — tap the 📱 icon in the header

---

## Settings (polling interval & notifications)

Go to **Settings → Devices & Services → SMS Gammu Viewer → Configure** (⚙️):

### Polling Interval

How often the integration checks for new SMS. Minimum 5 seconds, recommended 20–30 seconds.

> When an SMS arrives, the integration automatically enters **active collection mode**: polls every 3 seconds until the SIM is empty for 5 consecutive polls (~15 seconds of silence). The regular timer is paused during this time. If a long message arrives in multiple waves within a 2-minute window, the parts are automatically merged into one message.

### Push Notifications

Select devices from the dropdown list of all available `notify.*` services. Multiple devices supported.

Tapping the notification opens the SMS panel directly.

**How to find your device name** if it's not in the list:
- Go to **Developer Tools → Services** and start typing `notify.mobile_app_`
- Or check **Settings → Devices & Services → Mobile App**

---

## Modem Status & Auto-Recovery

Click the 📱 button in the SMS panel header to open the modem status page:

- 📶 Signal strength with visual bar
- 🌐 Network operator and registration state
- 📟 Modem manufacturer, model, firmware, IMEI
- 💾 SIM and phone memory usage + IMSI
- 🔄 Manual modem reset button

If the modem stops responding (5 consecutive failed polls), the integration **automatically calls the reset endpoint** and waits 15 seconds for recovery, with a cooldown of 2 minutes between automatic resets. A live warning (`⚠ Modem unavailable`) appears in the sidebar status bar while this is happening.

---

## How It Works

```
Sender's phone
       ↓ SMS
USB GSM modem
       ↓
sms-gammu-gateway (REST API :5000)
       ↓ GET /sms  (every N sec, or every 3 sec in collect mode)
SMS Gammu Viewer (custom component)
       ↓ DELETE /sms/deleteall
SQLite database (/config/sms_gammu_viewer.db)
       ↓
SMS panel in sidebar  +  Push notification  +  sensor.sms_unread_count
```

### Long SMS Assembly

Messages over 160 Latin / 70 Cyrillic characters are split by the carrier. The integration:

1. Detects first part → enters active collection mode
2. Polls modem every **3 seconds**, deletes each part from SIM immediately
3. After **5 empty polls (~15 sec)** — considers the current wave complete
4. If parts arrive in multiple separate waves within 2 minutes — automatically merges them into one message
5. Saves as one message, sends notification with full text

### Multi-language UI

The panel UI text (not just config flow) is fully translatable, independent of HA's own language setting. Translations live in `frontend/locales/{code}.js` as plain JS modules exporting a key-value object. To add a language:

1. Copy `frontend/locales/en.js` to `frontend/locales/{your-code}.js`
2. Translate the values
3. Add your language code to `AVAILABLE_LOCALES` in `panel.js`
4. Open a pull request

---

## Compatible Add-ons

| Project | Compatibility |
|---|---|
| [PavelVe/home-assistant-addons sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons) | ✅ |
| [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) | ✅ |

---

## Changelog

### v2.3.1
- ✍️ "New message" button moved to a full-width button at the bottom of the contacts sidebar — visible on mobile
- 🔧 Fixed hamburger menu button not appearing on mobile

### v2.3.0
- 🌐 i18n: English/Russian UI with in-panel language switcher, locale files for community contributions
- ✍️ Send SMS — reply in chat and start new conversations
- 📋 Copy message text on click
- 🩺 Automatic modem reset on repeated failures, with cooldown and status bar warning
- 🔔 Fixed 401 errors — automatic token refresh

### v2.2.0
- 🔄 Auto-refresh chat via event polling every 4 seconds
- 📶 Modem status page with signal, network, IMEI, SIM capacity and reset button
- 📱 Hamburger menu button on mobile for HA sidebar navigation
- 🗓 Date dividers in chat (Today, Yesterday, full date)
- 🧩 Improved multipart SMS: merge waves from same number within 2-minute window
- 🔔 Fixed iOS push notification tap — opens SMS panel directly

### v2.1.0
- 🔢 Unread SMS counter sensor (`sensor.sms_unread_count`) with sidebar badge

### v2.0.0
- Initial release: chat view, SQLite storage, config flow, smart SMS assembly, push notifications

---

## License

MIT

