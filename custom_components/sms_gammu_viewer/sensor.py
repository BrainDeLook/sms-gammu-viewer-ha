"""Сенсор — счётчик непрочитанных SMS."""
from __future__ import annotations

import logging

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from datetime import timedelta

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

SCAN_INTERVAL = timedelta(seconds=10)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    sensor = SmsUnreadSensor(hass, entry)
    async_add_entities([sensor], update_before_add=True)


class SmsUnreadSensor(SensorEntity):
    _attr_icon = "mdi:message-badge"
    _attr_native_unit_of_measurement = None
    _attr_has_entity_name = True
    _attr_name = "Unread SMS"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
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
            async_track_time_interval(
                self.hass, self._scheduled_update, SCAN_INTERVAL
            )
        )

    @callback
    async def _scheduled_update(self, _now=None) -> None:
        await self._update()

    async def _update(self) -> None:
        coord = self.hass.data.get(DOMAIN, {}).get(self._entry.entry_id)
        if not coord:
            return
        try:
            unread = await self.hass.async_add_executor_job(coord.store.unread_count)
            if unread != self._unread:
                self._unread = unread
                self.async_write_ha_state()
        except Exception as e:
            _LOGGER.debug("Unread update error: %s", e)
