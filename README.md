# SMS Gammu Viewer for Home Assistant

SMS viewer and dialer integration for Home Assistant using [gammu-gateway](https://github.com/BrainDeLook/gammu-gateway).

## Features

- 💬 **SMS inbox** — view, send, delete conversations
- 📞 **Call** — outgoing calls via modem (AT commands)
- 📖 **Phonebook** — contacts with names and labels
- 📌 **Pin conversations** — pinned chats stay at top
- 🔇 **Mute** — silence notifications per contact
- 📱 **Mobile swipe actions** — swipe left/right on conversations (mute, delete, read, pin)
- 🌐 **Localization** — Russian and English UI
- 🏠 **HA sensors** — unread count, last SMS number and text

## Requirements

- Home Assistant 2024.1+
- [gammu-gateway](https://github.com/BrainDeLook/gammu-gateway) running and accessible over HTTP
- USB GSM modem supported by Gammu

## Installation

### HACS (recommended)
1. Add this repo as a custom repository in HACS
2. Install **SMS Gammu Viewer**
3. Restart Home Assistant
4. Go to Settings → Integrations → Add → **SMS Gammu Viewer**

### Manual
```bash
cp -r custom_components/sms_gammu_viewer /config/custom_components/
```
Restart Home Assistant, then add the integration.

## Configuration

| Field | Description |
|-------|-------------|
| Host | gammu-gateway IP/hostname |
| Port | gammu-gateway port (default 5000) |
| Username / Password | HTTP Basic Auth credentials |
| Poll interval | How often to check for new SMS (seconds) |
| Call device | Serial device for AT commands (optional) |

## Sensors

| Entity | Description |
|--------|-------------|
| `sensor.sms_unread_count` | Number of unread messages |
| `sensor.sms_last_sms_number` | Sender of last received SMS |
| `sensor.sms_last_sms_text` | Text of last received SMS |

## Events

- `sms_gammu_viewer_sms_sent` — fired when SMS is sent

## Changelog

See [Releases](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases).
