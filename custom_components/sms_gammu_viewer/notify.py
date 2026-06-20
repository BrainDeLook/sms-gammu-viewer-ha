"""Notify-платформа для звонков. SMS отправляется через отдельный сервис sms_gammu_viewer.send_sms."""
from __future__ import annotations

import logging

from homeassistant.components.notify import NotifyEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_CALL_DEVICE,
    CONF_CALL_DIAL_TIMEOUT,
    CONF_CALL_DURATION,
    DEFAULT_CALL_DIAL_TIMEOUT,
    DEFAULT_CALL_DURATION,
    DOMAIN,
    EVENT_CALL_ENDED,
)
from .dialer import CallEndedReason, DialError, dial_number, hangup, validate_phone_number

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    call_device = entry.data.get(CONF_CALL_DEVICE, "").strip()
    if not call_device:
        # Голосовой порт не настроен — звонки недоступны, платформа не создаёт сущностей
        return
    async_add_entities([SmsGammuCallNotifyEntity(entry, call_device)])


class SmsGammuCallNotifyEntity(NotifyEntity):
    """notify.sms_gammu_call — отправь номер телефона в message чтобы позвонить."""

    _attr_has_entity_name = True
    _attr_name = "Call"
    _attr_icon = "mdi:phone-outgoing"

    def __init__(self, entry: ConfigEntry, device_path: str) -> None:
        self._entry = entry
        self._device_path = device_path
        self._attr_unique_id = f"{entry.entry_id}_call"
        self._busy = False

    async def async_send_message(self, message: str, title: str | None = None) -> None:
        """Совершает звонок. message = номер телефона (можно несколько через |)."""
        if not message or not message.strip():
            raise HomeAssistantError("Номер телефона обязателен в поле message")

        if self._busy:
            raise HomeAssistantError("Уже выполняется звонок")

        targets = [t.strip() for t in message.split("|") if t.strip()]
        if not targets:
            raise HomeAssistantError("Номер телефона обязателен в поле message")

        for t in targets:
            try:
                validate_phone_number(t)
            except DialError as e:
                raise HomeAssistantError(str(e)) from e

        dial_timeout = self._entry.data.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT)
        call_duration = self._entry.data.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION)

        self._busy = True
        try:
            for idx, number in enumerate(targets):
                _LOGGER.info("Calling +%s (%d/%d)...", number, idx + 1, len(targets))
                reason = await dial_number(
                    self._device_path, number,
                    dial_timeout_sec=dial_timeout,
                    call_duration_sec=call_duration,
                )
                self.hass.bus.async_fire(
                    EVENT_CALL_ENDED,
                    {"phone_number": number, "reason": reason.value},
                )
                if reason == CallEndedReason.ANSWERED:
                    _LOGGER.info("Call to +%s answered, stopping sequence", number)
                    break
                _LOGGER.info("Call to +%s: %s, trying next if any", number, reason.value)
        finally:
            self._busy = False


async def async_hangup_call(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Вспомогательная функция для принудительного завершения звонка (используется API)."""
    call_device = entry.data.get(CONF_CALL_DEVICE, "").strip()
    if not call_device:
        return False
    return await hangup(call_device)
