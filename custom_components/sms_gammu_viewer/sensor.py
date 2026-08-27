"""Сенсоры SMS Gammu Viewer: непрочитанные, номер и текст последнего SMS."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def _status_value(payload: object, keys: tuple[str, ...]):
    """Read a status field from both legacy and lean gateway responses."""
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if value not in (None, "", "unknown", "unavailable"):
                return value
    elif payload not in (None, "", "unknown", "unavailable"):
        return payload
    return None

SCAN_INTERVAL = timedelta(seconds=10)
MODEM_INFO_INTERVAL = timedelta(seconds=30)
LAST_SMS_TEXT_MAXLEN = 255  # ограничение state в HA
CHATS_LIMIT = 15            # сколько диалогов класть в атрибуты
CHAT_PREVIEW_MAXLEN = 100   # обрезка превью текста в атрибутах


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities(
        [
            SmsUnreadSensor(hass, entry),
            SmsLastNumberSensor(hass, entry),
            SmsLastTextSensor(hass, entry),
            SmsSignalSensor(hass, entry),
            SmsNetworkSensor(hass, entry),
            SmsChatsSensor(hass, entry),
        ],
        update_before_add=True,
    )


class _BaseSmsSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry

    def _coord(self):
        return self.hass.data.get(DOMAIN, {}).get(self._entry.entry_id)


class SmsUnreadSensor(_BaseSmsSensor):
    _attr_icon = "mdi:message-badge"
    _attr_name = "Unread SMS"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._unread = 0
        self._attr_unique_id = f"{entry.entry_id}_unread"

    @property
    def native_value(self) -> int:
        return self._unread

    @property
    def extra_state_attributes(self) -> dict:
        return {"panel_url": "/sms-viewer"}

    async def async_added_to_hass(self) -> None:
        await self._update()
        self.async_on_remove(
            async_track_time_interval(self.hass, self._scheduled_update, SCAN_INTERVAL)
        )

    async def _scheduled_update(self, _now=None) -> None:
        await self._update()

    async def _update(self) -> None:
        coord = self._coord()
        if not coord:
            return
        try:
            unread = await self.hass.async_add_executor_job(coord.store.unread_count)
            if unread != self._unread:
                self._unread = unread
                self.async_write_ha_state()
        except Exception as e:
            _LOGGER.debug("Unread update error: %s", e)


class SmsLastNumberSensor(_BaseSmsSensor):
    """Номер/отправитель последнего полученного SMS."""

    _attr_icon = "mdi:phone-incoming"
    _attr_name = "Last SMS Number"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._value: str | None = None
        self._attr_unique_id = f"{entry.entry_id}_last_number"

    @property
    def native_value(self) -> str | None:
        return self._value

    @property
    def extra_state_attributes(self) -> dict:
        return {"panel_url": "/sms-viewer"}

    async def async_added_to_hass(self) -> None:
        await self._load_initial()
        coord = self._coord()
        if coord:
            coord.register_sensor_listener(self._on_event)
            self.async_on_remove(lambda: coord.unregister_sensor_listener(self._on_event))

    async def _load_initial(self) -> None:
        coord = self._coord()
        if not coord:
            return
        try:
            rows = await self.hass.async_add_executor_job(coord.store.get_all)
            if rows:
                self._value = rows[0].get("number")
        except Exception as e:
            _LOGGER.debug("Last number initial load error: %s", e)

    @callback
    def _on_event(self, event_type: str, data: dict) -> None:
        if event_type != "new_message":
            return
        self._value = data.get("number")
        self.async_write_ha_state()


class SmsLastTextSensor(_BaseSmsSensor):
    """Текст последнего полученного SMS (обрезан до 255 символов — лимит state HA)."""

    _attr_icon = "mdi:message-text-clock"
    _attr_name = "Last SMS Text"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._value: str | None = None
        self._full_text: str | None = None
        self._number: str | None = None
        self._attr_unique_id = f"{entry.entry_id}_last_text"

    @property
    def native_value(self) -> str | None:
        return self._value

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "full_text": self._full_text,
            "number": self._number,
            "panel_url": "/sms-viewer",
        }

    async def async_added_to_hass(self) -> None:
        await self._load_initial()
        coord = self._coord()
        if coord:
            coord.register_sensor_listener(self._on_event)
            self.async_on_remove(lambda: coord.unregister_sensor_listener(self._on_event))

    async def _load_initial(self) -> None:
        coord = self._coord()
        if not coord:
            return
        try:
            rows = await self.hass.async_add_executor_job(coord.store.get_all)
            if rows:
                self._set_text(rows[0].get("text", ""), rows[0].get("number"))
        except Exception as e:
            _LOGGER.debug("Last text initial load error: %s", e)

    @callback
    def _on_event(self, event_type: str, data: dict) -> None:
        if event_type != "new_message":
            return
        self._set_text(data.get("text", ""), data.get("number"))
        self.async_write_ha_state()

    def _set_text(self, text: str, number: str | None) -> None:
        self._full_text = text
        self._number = number
        self._value = (
            text if len(text) <= LAST_SMS_TEXT_MAXLEN
            else text[: LAST_SMS_TEXT_MAXLEN - 1] + "…"
        )

class SmsSignalSensor(_BaseSmsSensor):
    """Качество сигнала модема в процентах."""
    _attr_icon = "mdi:signal"
    _attr_name = "Signal Quality"
    _attr_native_unit_of_measurement = "%"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._attr_unique_id = f"{entry.entry_id}_signal"
        self._signal = None
        self._unsub = None

    async def async_added_to_hass(self) -> None:
        self._unsub = async_track_time_interval(
            self.hass, self._update, SCAN_INTERVAL
        )
        await self._update()

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub:
            self._unsub()

    async def _update(self, _now=None) -> None:
        coord = self._coord()
        if not coord:
            return
        # Читаем кеш координатора (обновляется каждый цикл опроса) вместо
        # прямого запроса к модему — иначе сенсор дёргал gateway каждые
        # 10 секунд, в том числе во время отправки SMS и звонков
        cache = coord.status_cache
        if cache is not None:
            s = cache.get("signal")
            self._signal = s.get("SignalPercent") if isinstance(s, dict) else None
        self.async_write_ha_state()

    @property
    def native_value(self):
        return self._signal


class SmsChatsSensor(_BaseSmsSensor):
    """Список диалогов в атрибутах — источник данных для Lovelace-карточки.

    Карточка читает этот сенсор из hass.states и обновляется только когда
    HA пушит изменение состояния: пришло/прочитано/отправлено SMS —
    без собственных таймеров, fetch и токенов.

    Атрибут chats исключён из recorder (_unrecorded_attributes), чтобы
    история состояний не разбухала от JSON со списком диалогов.
    """

    _attr_icon = "mdi:message-text"
    _attr_name = "SMS Chats"
    _unrecorded_attributes = frozenset({"chats", "signal_percent", "network_name"})

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._attr_unique_id = f"{entry.entry_id}_chats"
        self._chats: list[dict] = []
        self._unread_total = 0
        self._signal_percent = None
        self._network_name = None

    @property
    def native_value(self) -> int:
        return self._unread_total

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "chats": self._chats,
            "signal_percent": self._signal_percent,
            "network_name": self._network_name,
            "panel_url": "/sms-viewer",
        }

    async def async_added_to_hass(self) -> None:
        await self._refresh()
        coord = self._coord()
        if coord:
            coord.register_sensor_listener(self._on_event)
            self.async_on_remove(lambda: coord.unregister_sensor_listener(self._on_event))
        # Сигнал/оператор меняются сами по себе, без событий — освежаем
        # их из кеша координатора по таймеру (state пишется только если
        # что-то реально изменилось)
        self.async_on_remove(
            async_track_time_interval(self.hass, self._modem_tick, MODEM_INFO_INTERVAL)
        )

    @callback
    def _on_event(self, event_type: str, data: dict) -> None:
        if event_type == "call_ended":
            return  # звонки на список чатов не влияют
        self.hass.async_create_task(self._refresh_and_write())

    async def _modem_tick(self, _now=None) -> None:
        if self._pull_modem_info():
            self.async_write_ha_state()

    def _pull_modem_info(self) -> bool:
        coord = self._coord()
        if not coord or coord.status_cache is None:
            return False
        cache = coord.status_cache
        s = cache.get("signal")
        n = cache.get("network")
        signal = _status_value(s, ("SignalPercent", "signal_percent", "signal"))
        network = _status_value(
            n, ("NetworkName", "network_name", "Operator", "operator", "name")
        )
        changed = signal != self._signal_percent or network != self._network_name
        self._signal_percent = signal
        self._network_name = network
        return changed

    async def _refresh_and_write(self) -> None:
        await self._refresh()
        self.async_write_ha_state()

    async def _refresh(self) -> None:
        coord = self._coord()
        if not coord:
            return
        try:
            contacts = await self.hass.async_add_executor_job(coord.store.get_contacts)
        except Exception as e:
            _LOGGER.debug("Chats refresh error: %s", e)
            return
        self._unread_total = sum(c.get("unread") or 0 for c in contacts)
        self._chats = [
            {
                "number": c.get("number"),
                "contact_name": c.get("contact_name"),
                "avatar": c.get("avatar") or "",
                "brand_logo_url": c.get("brand_logo_url") or "",
                "last_text": (c.get("last_text") or "")[:CHAT_PREVIEW_MAXLEN],
                "last_date": c.get("last_date"),
                "unread": c.get("unread") or 0,
                "is_muted": c.get("is_muted", False),
                "is_pinned": c.get("is_pinned", False),
            }
            for c in contacts[:CHATS_LIMIT]
        ]
        self._pull_modem_info()


class SmsNetworkSensor(_BaseSmsSensor):
    """Название оператора сети."""
    _attr_icon = "mdi:sim"
    _attr_name = "Network Operator"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._attr_unique_id = f"{entry.entry_id}_network"
        self._operator = None
        self._unsub = None

    async def async_added_to_hass(self) -> None:
        self._unsub = async_track_time_interval(
            self.hass, self._update, SCAN_INTERVAL
        )
        await self._update()

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub:
            self._unsub()

    async def _update(self, _now=None) -> None:
        coord = self._coord()
        if not coord:
            return
        # Из кеша координатора — см. комментарий в SmsSignalSensor
        cache = coord.status_cache
        if cache is not None:
            n = cache.get("network")
            self._operator = _status_value(
                n, ("NetworkName", "network_name", "Operator", "operator", "name")
            )
        self.async_write_ha_state()

    @property
    def native_value(self):
        return self._operator
