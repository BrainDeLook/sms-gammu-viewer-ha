"""Button-платформа: каждая сущность дозванивается на фиксированный номер
при нажатии. Простой вариант без условного состояния open/closed.
"""
from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CALL_ENTITY_TYPE_BUTTON,
    CONF_CALL_DEVICE,
    CONF_CALL_ENTITIES,
    DOMAIN,
)
from .dialer import dial_number

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    call_device = entry.data.get(CONF_CALL_DEVICE, "").strip()
    if not call_device:
        return

    entities_cfg = entry.options.get(CONF_CALL_ENTITIES, [])
    buttons = [
        CallButtonEntity(hass, entry, call_device, cfg)
        for cfg in entities_cfg
        if cfg.get("entity_type") == CALL_ENTITY_TYPE_BUTTON
    ]
    if buttons:
        async_add_entities(buttons)


class CallButtonEntity(ButtonEntity):
    """button.* — нажатие дозванивается на заданный номер."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:phone-outgoing"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, device_path: str, cfg: dict) -> None:
        self.hass = hass
        self._entry = entry
        self._device_path = device_path
        self._cfg = cfg
        self._attr_name = cfg["name"]
        self._attr_unique_id = f"{entry.entry_id}_call_button_{cfg['id']}"

    @property
    def extra_state_attributes(self) -> dict:
        return {"phone_number": self._cfg["number"]}

    async def async_press(self) -> None:
        coord = self.hass.data.get(DOMAIN, {}).get(self._entry.entry_id)
        if coord:
            coord.call_in_progress = True
        try:
            reason = await dial_number(
                self._device_path,
                self._cfg["number"],
                dial_timeout_sec=self._cfg.get("dial_timeout", 25),
                call_duration_sec=self._cfg.get("call_duration", 30),
            )
            _LOGGER.info(
                "Call button '%s' dialed %s: %s",
                self._attr_name, self._cfg["number"], reason.value,
            )
        except Exception as e:
            _LOGGER.error("Call button '%s' dial error: %s", self._attr_name, e)
        finally:
            if coord:
                coord.call_in_progress = False

