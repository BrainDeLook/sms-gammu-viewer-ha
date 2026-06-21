"""Cover-платформа: каждая сущность дозванивается на фиксированный номер при
открытии/закрытии. Используется для ворот/шлагбаумов, открывающихся по
входящему звонку (распространённая схема GSM-реле для домофонов и ворот).
"""
from __future__ import annotations

import asyncio
import logging

from homeassistant.components.cover import CoverEntity, CoverEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CALL_ENTITY_TYPE_COVER,
    CONF_CALL_DEVICE,
    CONF_CALL_ENTITIES,
)
from .dialer import CallEndedReason, dial_number

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    call_device = entry.data.get(CONF_CALL_DEVICE, "").strip()
    if not call_device:
        # Без голосового порта сущности звонков создавать бессмысленно
        return

    entities_cfg = entry.options.get(CONF_CALL_ENTITIES, [])
    covers = [
        CallCoverEntity(hass, entry, call_device, cfg)
        for cfg in entities_cfg
        if cfg.get("entity_type") == CALL_ENTITY_TYPE_COVER
    ]
    if covers:
        async_add_entities(covers)


class CallCoverEntity(CoverEntity):
    """Cover, который "открывается" совершая звонок на заданный номер.

    Состояние open/closed чисто условное — реального датчика положения нет.
    Сразу при нажатии "открыть" сущность переходит в open (без промежуточного
    "opening"), и если auto_close включён — возвращается в closed сразу
    после завершения звонка, вне зависимости от результата.
    """

    _attr_has_entity_name = True
    _attr_supported_features = CoverEntityFeature.OPEN | CoverEntityFeature.CLOSE
    _attr_device_class = "gate"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, device_path: str, cfg: dict) -> None:
        self.hass = hass
        self._entry = entry
        self._device_path = device_path
        self._cfg = cfg
        self._attr_name = cfg["name"]
        self._attr_unique_id = f"{entry.entry_id}_call_cover_{cfg['id']}"
        self._is_closed = True

    @property
    def is_closed(self) -> bool:
        return self._is_closed

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "phone_number": self._cfg["number"],
            "auto_close": self._cfg.get("auto_close", True),
        }

    async def async_open_cover(self, **kwargs) -> None:
        """Сразу переходит в open и дозванивается на номер в фоне."""
        self._is_closed = False
        self.async_write_ha_state()

        try:
            reason = await dial_number(
                self._device_path,
                self._cfg["number"],
                dial_timeout_sec=self._cfg.get("dial_timeout", 25),
                call_duration_sec=self._cfg.get("call_duration", 30),
            )
            _LOGGER.info(
                "Call cover '%s' dialed %s: %s",
                self._attr_name, self._cfg["number"], reason.value,
            )
        except Exception as e:
            _LOGGER.error("Call cover '%s' dial error: %s", self._attr_name, e)
        finally:
            if self._cfg.get("auto_close", True):
                self._is_closed = True
            self.async_write_ha_state()

    async def async_close_cover(self, **kwargs) -> None:
        """Просто переводит сущность в закрытое состояние (визуально)."""
        self._is_closed = True
        self.async_write_ha_state()


