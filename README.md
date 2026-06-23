# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇷🇺 [Русская версия](README_RU.md)

A native panel for **SMS messaging and voice calls** directly in Home Assistant. Works with the [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on and any compatible gateway based on [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

> 💬 **Send & receive SMS** · 📞 **Outgoing voice calls** · 📇 **Phonebook** · 🔔 **Push notifications** · 🚪 **Call entities for gates & intercoms**

After installation, an **SMS** tab appears in the sidebar. Messages are stored in an internal SQLite database and are automatically deleted from the modem after being received.

<p align="center">
  <img src="screenshots/desktop.jpg" alt="Desktop view" width="70%"><br>
  <sub>Desktop — chat list, conversation thread, send box</sub>
</p>

---


## Features

- 💬 **Chat-style SMS** — all messages from one sender in one thread, with full send/receive support
- 📞 **Outgoing voice calls** (dial-only) — via a separate voice AT interface on modems with multiple serial ports (e.g. Huawei)
- 🚪 **Call entities** — `cover`/`button` entities that dial a fixed number, for gates and intercoms that open via a phone call
- 📇 **Phonebook** — save contact names, shown across conversations, call history, and chat headers
- 🔔 **Push notifications** — on new SMS with tap-to-open (iOS & Android), grouped by sender
- 🩺 **Automatic modem recovery** — resets the modem after repeated failures, with a live warning in the status bar
- 📨 **Sensors** — `sensor.sms_unread_count`, `sensor.sms_last_sms_number`, `sensor.sms_last_sms_text` for automations
- 🌐 **English / Russian UI** — switchable independently of HA's language
- 🔍 **Search** by phone number or message text
- 📱 **Mobile-friendly** — responsive layout with bottom sheet menus and back navigation

---

## Requirements

- Home Assistant 2024.3+
- Running [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) add-on with REST API on port 5000
- For push notifications: [Home Assistant Companion](https://companion.home-assistant.io/) app on your phone

> ⚠️ **Important — disable these in the sms-gammu-gateway add-on configuration before using this integration:**
> - **SMS monitoring / automatic SMS polling** (`SMS_CHECK_INTERVAL` or equivalent) — otherwise the add-on and this integration will simultaneously read and delete messages from the SIM, causing message loss. SMS Gammu Viewer takes over all polling logic.
> - **Auto-delete read SMS** — let the integration handle deletion from the SIM itself; the add-on deleting messages independently will interfere with multipart SMS assembly.
> - **Call monitoring / voice call handling** — if the add-on has its own call-related polling, turn it off; this integration manages voice calls separately through the modem's AT interface.
> - **MQTT** — disable it too if enabled, just to be safe; this integration doesn't use or expect MQTT and an active MQTT publisher in the add-on can add unnecessary load.

### Tested Hardware

This integration (including the optional voice call feature) has been confirmed working on:

- **Modem:** Huawei E1550 USB 3G modem
- **Host:** Raspberry Pi 5 running Home Assistant OS

Other USB GSM modems and hosts should work as long as Gammu supports them for SMS, and — for voice calls specifically — the modem exposes a separate serial interface for voice AT commands alongside the data interface.

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

Some USB GSM modems (notably Huawei) expose **multiple serial interfaces** over a single USB connection — typically one for data/SMS and a separate one for voice AT commands (e.g. `/dev/serial/by-id/...-if00-port0` for data, `...-if02-port0` for voice). When that's the case, this integration can dial calls directly over the voice interface, completely independent of sms-gammu-gateway's REST API, with **no risk of port conflicts**.

> This feature is **dial-only** — the call connects and rings on the recipient's end, but no audio is routed through Home Assistant. Useful for "ring my phone" style automations (doorbell-style notifications, alerts) rather than two-way conversations.

### Setup

1. Identify your modem's voice interface, e.g.:
   ```
   ls -la /dev/serial/by-id/
   ```
   Look for a second device path alongside the one used by sms-gammu-gateway.
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

> ⚠️ **Restart Home Assistant after adding, editing, or deleting a call entity.** These entities are created when the integration starts up, so changes made through the config flow won't appear (or disappear) until the next restart — saving the form alone is not enough.

Cover entities use the `gate` device class by default; you can change the displayed icon/type (garage door, door, gate, etc.) per-entity from the entity's own settings in Home Assistant. Requires a voice call device to be configured (see Voice Calls above) — entities won't be created without one.

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

Messages over 160 Latin / 70 Cyrillic characters are split by the carrier into multiple parts. How Gammu's gateway actually exposes this matters: rather than returning each part as a separate record to concatenate, it returns the **same SMS record growing over time** — each poll of `/sms` gives a progressively longer snapshot of the same message as more radio parts arrive.

The integration handles this by:

1. Detecting the first snapshot → entering active collection mode
2. Polling the modem every **N seconds** (configurable, default 2s), deleting each snapshot from the SIM immediately after reading
3. Tracking the **longest text seen** for each sender — a new poll either confirms the same length (ignored) or replaces the stored text with a longer, more complete version
4. After **M empty polls in a row** (configurable, default 5) — considers the message complete and saves the longest version seen
5. If parts arrive in separate waves more than the empty-poll window apart but within 2 minutes — automatically merges them as a fallback safety net
6. Sends the notification with the full assembled text

Both the polling delay and the empty-poll threshold are configurable in **Settings → SMS Gammu Viewer → Configure** — tune them to find the right balance of speed vs. reliability for your carrier and signal conditions.

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

## Credits & Inspiration

This project builds on the work of several open-source projects:

- **[pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway)** and **[PavelVe/home-assistant-addons](https://github.com/PavelVe/home-assistant-addons)** — the underlying SMS gateway add-on this integration connects to via REST API.
- **[Daring-Designs/meshtastic-ui-ha](https://github.com/Daring-Designs/meshtastic-ui-ha)** — the native HA sidebar panel architecture (custom panel registration via `async_register_built_in_panel`, static path serving) was modeled after this project.
- **[black-roland/homeassistant-gsm-call](https://github.com/black-roland/homeassistant-gsm-call)** — the original voice call dialing logic (AT command sequences, `AT+CLCC` polling for call state, serial connection parameters) that this integration's call feature is closely based on. All credit for figuring out the working AT dialing approach for GSM modems goes to this project.
- **[frenck/home-assistant-doom](https://github.com/frenck/home-assistant-doom)** — the technique for bundling a Lovelace dashboard card directly inside an integration (registering frontend JS globally via `add_extra_js_url`, the same way static assets are served for the sidebar panel) is based on this project's approach.

---

## License

MIT















