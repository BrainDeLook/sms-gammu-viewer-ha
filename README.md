# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇷🇺 [Русская версия](README_RU.md)

A native panel for viewing incoming SMS messages directly in Home Assistant. Works with the [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on and any compatible gateway based on [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

After installation, an **SMS** tab appears in the sidebar with all your conversations. Messages are stored inside Home Assistant and are independent of SIM card memory — they are automatically deleted from the modem after being received.

---

## Features

- 💬 Conversations by number — all SMS from one sender in one chat thread
- 🔵 Unread message highlighting and counters
- 🔍 Search by phone number or message text
- 🗄 Internal HA storage (SQLite) — messages are never lost due to SIM overflow
- 🔄 Smart multipart SMS assembly — long messages are collected in full before display
- 📲 Push notifications to your phone on new SMS
- 🗑 Delete individual messages or entire conversations
- ⚙️ Configurable polling interval from the HA UI
- 📶 Signal strength and carrier status in the panel

---

## Requirements

- Home Assistant 2023.1+
- Running [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on with REST API on port 5000
- For push notifications: [Home Assistant Companion](https://companion.home-assistant.io/) app on your phone

> ⚠️ **Important:** In the sms-gammu-gateway add-on configuration, **disable automatic SMS polling** (the `SMS_CHECK_INTERVAL` parameter or equivalent). Otherwise the add-on and this integration will simultaneously read and delete messages from the SIM card, causing message loss. SMS Gammu Viewer takes over all polling logic.

---

## Installation

### Via HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Or manually:

1. Open **HACS** in Home Assistant
2. Click the three dots (⋮) in the top right → **Custom repositories**
3. Paste the URL: `https://github.com/BrainDeLook/sms-gammu-viewer-ha`
4. Category: **Integration** → click **Add**
5. Find **SMS Gammu Viewer** → click **Download**
6. Restart Home Assistant

### Manual installation

1. Download the [latest release](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
2. Copy the `custom_components/sms_gammu_viewer/` folder to `<config>/custom_components/`
3. Restart Home Assistant

---

## Initial Setup

After restarting HA:

1. Go to **Settings → Devices & Services**
2. Click **+ Add Integration**
3. Search for **SMS Gammu Viewer**
4. Fill in the form:

| Field | Description | Example |
|---|---|---|
| **Host** | IP address or hostname where the add-on is running | `localhost` or `192.168.1.100` |
| **Port** | REST API port of the add-on | `5000` |
| **Username** | Add-on login | `admin` |
| **Password** | Add-on password | `password` |

> If the add-on runs on the same machine as HA — use `localhost`. Otherwise enter its IP address.

5. Click **Submit** — the integration will verify the connection
6. The **SMS** icon (💬) will appear in the sidebar

---

## Settings (polling interval & notifications)

To change the polling interval or add devices for push notifications:

1. Go to **Settings → Devices & Services**
2. Find the **SMS Gammu Viewer** card
3. Click **Configure** (⚙️ gear icon)

### Polling Interval

How often the integration checks for new SMS on the modem. Minimum is 5 seconds, recommended is 20–30 seconds.

> When an SMS arrives, the integration automatically switches to active collection mode: it polls the modem every 3 seconds until it confirms that all parts of a long message have been received. The regular timer is paused during this time.

### Push Notifications

The **"Notification targets"** field — enter notify services one per line.

**How to find your device name:**

1. Install the [Home Assistant](https://companion.home-assistant.io/) app on your phone and log in to your HA instance
2. Go to **Settings → Devices & Services → Integrations**
3. Find the **Mobile App** integration and open it
4. You will see your device listed, e.g. `iPhone Daniil`
5. The service name is generated automatically: spaces → underscores, all lowercase

For example, if your device is `iPhone Daniil` → the service will be `notify.mobile_app_iphone_daniil`

You can also find the exact name via **Developer Tools → Services**: start typing `notify.mobile_app_` and all available devices will appear.

**Example with multiple devices:**
```
notify.mobile_app_iphone_daniil
notify.mobile_app_samsung_galaxy_s24
```

After saving, every new SMS will send a notification to all listed devices:
```
New SMS
From: +79001234567
Text: Message text...
```

Tapping the notification will open the SMS panel in Home Assistant.

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
       ↓ DELETE /sms/deleteall  (removes from SIM)
SQLite database inside HA (/config/sms_gammu_viewer.db)
       ↓
SMS panel in sidebar  +  Push notification to phone
```

### Long SMS Assembly

Long messages (>160 Latin chars or >70 Cyrillic chars) are split into parts by the carrier and delivered one by one. The integration handles this automatically:

1. Detects the first part → enters active collection mode
2. Polls the modem every **3 seconds**
3. Each received part is added to a buffer and immediately deleted from the SIM
4. When 10 consecutive polls return empty (≈30 seconds of silence) — the SMS is considered complete
5. All parts are joined and saved as a single message

---

## Compatible Add-ons / Gateways

| Project | Compatibility |
|---|---|
| [PavelVe/home-assistant-addons sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons) | ✅ |
| [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) | ✅ |

---

## License

MIT
