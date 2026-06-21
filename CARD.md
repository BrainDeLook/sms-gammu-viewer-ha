# SMS Gammu Viewer Card — Configuration Reference

> 🇷🇺 [Русская версия](CARD_RU.md)

The dashboard card is bundled directly into the [SMS Gammu Viewer](https://github.com/BrainDeLook/sms-gammu-viewer-ha) integration — no separate install needed. There's no visual editor yet, so the card is configured entirely through YAML.

## Adding the card

**Edit Dashboard → Add Card → Manual**, then paste your config, or add it directly to your dashboard's YAML.

## All configuration keys

| Key | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | Always `custom:sms-gammu-viewer-card`. Required. |
| `title` | string | `"SMS"` | Text shown in the card header. |
| `max_items` | number | `5` | Maximum number of conversations to display. Conversations are sorted by most recent message first; this caps how many are shown regardless of how many total conversations exist. |
| `show_unread_only` | boolean | `false` | When `true`, only conversations with at least one unread message are shown. Read conversations are filtered out entirely (not just hidden behind a toggle). |
| `panel_url` | string | `"/sms-viewer"` | The sidebar panel URL the card navigates to when you tap a conversation or the "Open all messages" link. Only change this if you've customized the panel's URL path in the integration somehow — the default matches the integration out of the box. |

## Full example — every key set explicitly

```yaml
type: custom:sms-gammu-viewer-card
title: Recent SMS
max_items: 8
show_unread_only: true
panel_url: /sms-viewer
```

## Minimal example — defaults only

```yaml
type: custom:sms-gammu-viewer-card
```

This is equivalent to:

```yaml
type: custom:sms-gammu-viewer-card
title: SMS
max_items: 5
show_unread_only: false
panel_url: /sms-viewer
```

## Common configurations

**Compact unread-only widget, good for a small dashboard corner:**
```yaml
type: custom:sms-gammu-viewer-card
title: Unread
max_items: 3
show_unread_only: true
```

**Full overview of recent activity:**
```yaml
type: custom:sms-gammu-viewer-card
title: All Messages
max_items: 15
show_unread_only: false
```

## Behavior notes

- The card polls the integration's API every 15 seconds while visible, so unread counts and previews stay current without a manual refresh.
- Tapping any conversation row, or the "Open all messages →" link at the bottom, navigates to the full SMS Gammu Viewer panel in the sidebar.
- The unread badge in the card header shows the **total** unread count across all conversations, not just the ones currently displayed (i.e. it's not affected by `max_items`).
- Requires the SMS Gammu Viewer integration to be installed and configured — the card has no functionality on its own.
