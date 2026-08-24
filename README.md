# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇷🇺 [Русская версия](README_RU.md)

A native panel for **SMS messaging and voice calls** directly in Home Assistant. It is designed for the companion [SMS Modem Gateway](https://github.com/BrainDeLook/sms-modem-gateway-ha), which safely assembles multipart SMS and hands complete messages to Home Assistant through a durable REST queue.

> 💬 **Send & receive SMS** · 📞 **Outgoing voice calls** · 📇 **Phonebook** · 🔔 **Push notifications** · 🚪 **Call entities for gates & intercoms**

After installation, an **SMS** tab appears in the sidebar. Messages are stored in an internal SQLite database and are automatically deleted from the modem after being received.

<p align="center">
  <img src="screenshots/desktop.jpg" alt="Desktop view" width="70%"><br>
  <sub>Desktop — chat list, conversation thread, send box</sub>
</p>

---


## Features

- 💬 **Chat-style SMS** — all messages from one sender grouped in one thread
- 📤 **Send SMS** from any conversation or start a new one with the `+` button
- 🔢 **Character counter** with GSM limits (160 latin / 70 cyrillic), shows SMS parts count
- 🔍 **Search** by phone number or message text
- 📌 **Pin conversations** — pinned chats stay at the top
- 🔕 **Mute** contacts — disable notifications per contact
- ⭐ **Starred messages** — mark messages as favourite, filter by star in chat header
- 👆 **Long press** (mobile) / **right click** (desktop) — copy, star, delete message
- 👈 **Swipe actions** (mobile) — swipe left: mute/delete, swipe right: mark read/pin
- 📞 **Outgoing voice calls** via AT interface
- 📖 **Contact profiles** — name, photo, label, email, company, birthday, notes and custom social/contact methods
- 📡 **Modem status page** — signal, network, SIM, memory, firmware, IMEI
- 💾 **Storage stats** — DB size and message count, with clear-all button
- 🏠 **HA sensors** — unread count, last SMS, signal quality %, network operator
- 🔔 **Push notifications** on new SMS with tap-to-open (iOS & Android)
- 🃏 **Lovelace card** — compact widget for your dashboard
- 🌍 **English / Russian** UI

## Requirements

- Home Assistant 2024.3+
- [SMS Modem Gateway](https://github.com/BrainDeLook/sms-modem-gateway-ha) add-on
- USB GSM modem supported by Gammu (e.g. Huawei E1550, E3372, ZTE MF823)
- For push notifications: [Home Assistant Companion](https://companion.home-assistant.io/) app

## Installation

### 1. Install SMS Modem Gateway

1. Open **Settings → Add-ons → Add-on Store**
2. Open ⋮ → **Repositories**
3. Add `https://github.com/BrainDeLook/sms-modem-gateway-ha`
4. Install **SMS Modem Gateway**
5. Select the modem serial device, set a username and password, then start the add-on

Do not run another SMS gateway against the same modem port at the same time.

### 2. Install SMS Gammu Viewer via HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Or manually:

1. Open **HACS** in Home Assistant
2. Click ⋮ → **Custom repositories**
3. Paste: `https://github.com/BrainDeLook/sms-gammu-viewer-ha` — Category: **Integration**
4. Find **SMS Gammu Viewer** → **Download**
5. Restart Home Assistant

### Manual integration installation

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

## Services for Automations

All available under **Developer Tools → Services**, under the `sms_gammu_viewer` domain:

| Service | Fields | Description |
|---|---|---|
| `sms_gammu_viewer.send_sms` | `number`, `message` | Sends an SMS |
| `sms_gammu_viewer.call` | `number` | Dials a number (requires voice port configured) |
| `sms_gammu_viewer.hangup` | — | Force-ends the current call |

### Events fired on the HA event bus

| Event | Data | Description |
|---|---|---|
| `sms_gammu_viewer_sms_sent` | `number`, `message` | Fired after every outgoing SMS |
| `sms_gammu_viewer_call_ended` | `phone_number`, `reason` | Fired when a call ends (`answered` / `not_answered` / `declined` / `error`) |

Example:
```yaml
service: sms_gammu_viewer.send_sms
data:
  number: "+79001234567"
  message: "The garage door was left open"
```

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

## Voice Calls (Dial-Only)

Some USB GSM modems (notably Huawei) expose **multiple serial interfaces** over one USB connection — typically one for SMS and a separate one for voice AT commands. The integration can dial directly over the voice interface, independently of SMS Modem Gateway's REST API, with **no risk of port conflicts**.

> This feature is **dial-only** — the call connects and rings on the recipient's end, but no audio is routed through Home Assistant. Useful for "ring my phone" style automations (doorbell-style notifications, alerts) rather than two-way conversations.

### Setup

1. Identify your modem's voice interface, e.g.:
   ```
   ls -la /dev/serial/by-id/
   ```
   Look for a second device path alongside the one used by SMS Modem Gateway.
2. Go to **Settings → Devices & Services → SMS Gammu Viewer → Configure**
3. Fill in the **voice call serial port** field with that path
4. Save and restart Home Assistant

Leave the field empty to keep this feature fully disabled — it has zero effect on SMS functionality either way.

### Usage

- **Standalone call button** — a green floating button (📞) appears next to "New message" in the contacts sidebar once a voice port is configured. Tap it to open a dropdown with your call history (last 30 calls, with outcome icons), showing the 4 most recent and scrollable for the rest, plus a field to dial a new number — no existing conversation required.
- **Call button in chat** — also available in an open conversation's header.
- **Automations** — call the `sms_gammu_viewer.call` service with a phone number:
  ```yaml
  service: sms_gammu_viewer.call
  data:
    number: "+79001234567"
  ```
  Use `sms_gammu_viewer.hangup` (no fields) to force-end the current call.
- **Event** — `sms_gammu_viewer_call_ended` fires with `phone_number` and `reason` (`answered`, `not_answered`, `declined`, `error`) for use in automations.

### Compatibility

Requires a modem with hardware flow control support on its voice AT interface (`dsrdtr`/`rtscts`). Confirmed working on Huawei USB modems at baudrate 75600. If your modem only exposes a single serial port, this feature can't be used — leave the field empty.

---

## Call Entities (Cover / Button)

Beyond the panel's call button, you can create dedicated Home Assistant entities that dial a fixed phone number when triggered — useful for a gate, garage door, or intercom that opens via an incoming call. These behave like any other `cover`/`button` entity, so they work with dashboards, automations, and voice assistants (Alexa, Google Home, Yandex Alice) out of the box.

### Setup

1. **Settings → SMS Gammu Viewer → Configure** — opens a menu now, choose **Call entities**
2. **➕ Add entity**
3. Choose type:
   - **Cover** — `open_cover` dials the number immediately; the entity shows as "open" right away (no stuck "opening" state) while the call happens in the background. If **Auto-close** is enabled, it returns to "closed" once the call ends, regardless of outcome
   - **Button** — a simple one-tap dial button, no state
4. Set name, phone number, dial timeout, and max call duration
5. Save


Cover entities use the `gate` device class by default; you can change the displayed icon/type (garage door, door, gate, etc.) per-entity from the entity's own settings in Home Assistant. Requires a voice call device to be configured (see Voice Calls above) — entities won't be created without one.

---

## How It Works

```
Sender's phone
       ↓ SMS
USB GSM modem
       ↓
SMS Modem Gateway (REST API :5000)
       ↓ durable logical-message queue + ID acknowledgement
SMS Gammu Viewer (custom component)
       ↓ one already-linked logical SMS at a time
SQLite database (/config/sms_gammu_viewer.db)
       ↓
SMS panel in sidebar  +  Push notification  +  sensor.sms_unread_count
```

### Long SMS Assembly

Messages over 160 Latin / 70 Cyrillic characters are split by the carrier into physical transport parts. SMS Modem Gateway reads those records without relying on `gammu.LinkSMS`, parses standard 8-bit and 16-bit concatenation UDH and waits for an exact, conflict-free set of parts.

Before deleting anything from the modem, the gateway commits the complete logical message and its cleanup journal to SQLite. It then deletes only physical records whose location fingerprint still matches and exposes the message through a durable ID-based REST queue. SMS Gammu Viewer stores it in its own SQLite database before acknowledging the queue ID. Retries are therefore safe across network errors, restarts and delayed multipart delivery.

### Multi-language UI

The panel UI text (not just config flow) is fully translatable, independent of HA's own language setting. Translations live in `frontend/locales/{code}.js` as plain JS modules exporting a key-value object. To add a language:

1. Copy `frontend/locales/en.js` to `frontend/locales/{your-code}.js`
2. Translate the values
3. Add your language code to `AVAILABLE_LOCALES` in `panel.js`
4. Open a pull request

---

## Gateway compatibility

| Project | Compatibility |
|---|---|
| [BrainDeLook/SMS Modem Gateway](https://github.com/BrainDeLook/sms-modem-gateway-ha) | ✅ Recommended: durable queue and reliable multipart UDH assembly |
| Legacy pajikos-compatible gateways | ⚠️ Compatibility fallback only; they do not provide the same delivery guarantees |

---

## Dashboard Card

Want recent conversations visible right on your dashboard, not just in the sidebar panel? A compact Lovelace card is **built directly into this integration** — no separate install needed.

```yaml
type: custom:sms-gammu-viewer-card
title: SMS
max_items: 5
show_unread_only: false
```

Add it via **Edit Dashboard → Add Card → Manual** with the YAML above, or search for "SMS Gammu Viewer Card" in the card picker. The card becomes available automatically once the integration is set up — Home Assistant loads its JS the same way it loads the sidebar panel's assets.

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | `SMS` | Card header text |
| `max_items` | number | `5` | Number of conversations to show |
| `show_unread_only` | boolean | `false` | Only show conversations with unread messages |

📄 See **[CARD.md](CARD.md)** for the full configuration reference — every key explained, with full and minimal examples plus common configurations (compact unread-only widget, full overview, etc).

> Older installs may still have the standalone [sms-gammu-viewer-card](https://github.com/BrainDeLook/sms-gammu-viewer-card) repository added via HACS — it's no longer needed and can be removed; this integration now provides the same card under the same name.

---

## Sidebar Unread Badge

The integration displays a blue badge with the total unread SMS count next to
the **SMS** sidebar icon. No additional frontend plugin or YAML is required.
The count refreshes in the background and disappears when messages are read.

Enable or disable it under **Settings → Devices & Services → SMS Gammu Viewer →
Configure → General settings → Show unread SMS count in sidebar**. It is enabled
by default.

---

## Credits & Inspiration

This project builds on the work of several open-source projects:

- **[Gammu](https://wammu.eu/gammu/)** and **python-gammu** — low-level modem communication used by SMS Modem Gateway. Multipart assembly, persistence and delivery are implemented by the companion gateway rather than delegated to `gammu.LinkSMS`.
- **[Daring-Designs/meshtastic-ui-ha](https://github.com/Daring-Designs/meshtastic-ui-ha)** — the native HA sidebar panel architecture (custom panel registration via `async_register_built_in_panel`, static path serving) was modeled after this project.
- **[black-roland/homeassistant-gsm-call](https://github.com/black-roland/homeassistant-gsm-call)** — the original voice call dialing logic (AT command sequences, `AT+CLCC` polling for call state, serial connection parameters) that this integration's call feature is closely based on. All credit for figuring out the working AT dialing approach for GSM modems goes to this project.
- **[frenck/home-assistant-doom](https://github.com/frenck/home-assistant-doom)** — the technique for bundling a Lovelace dashboard card directly inside an integration (registering frontend JS globally via `add_extra_js_url`, the same way static assets are served for the sidebar panel) is based on this project's approach.
- **[C3H3-AI/hacs-vision](https://github.com/C3H3-AI/hacs-vision)** — the authenticated Home Assistant WebSocket approach used for a dynamic sidebar badge.

---

## License

MIT















