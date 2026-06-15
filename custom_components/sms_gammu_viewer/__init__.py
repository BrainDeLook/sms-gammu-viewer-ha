"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path

import aiohttp
from aiohttp import web

from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_HOST,
    CONF_NOTIFY_TARGETS,
    CONF_PASSWORD,
    CONF_POLL_INTERVAL,
    CONF_PORT,
    CONF_USERNAME,
    DB_FILENAME,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
    FRONTEND_PATH,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
)
from .gateway import GatewayClient
from .store import SmsStore

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

MULTIPART_WAIT = 10


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    db_path = Path(hass.config.config_dir) / DB_FILENAME
    store = SmsStore(db_path)
    await hass.async_add_executor_job(store.init)

    client = GatewayClient(entry.data)
    coordinator = SmsCoordinator(hass, entry, store, client)
    hass.data[DOMAIN][entry.entry_id] = coordinator

    is_first = len(hass.data[DOMAIN]) == 1
    if is_first:
        await _register_panel(hass)

    hass.http.register_view(SmsApiView(hass))
    await coordinator.start()
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    _LOGGER.info("SMS Gammu Viewer started: %s", entry.title)
    return True


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    coordinator: SmsCoordinator = hass.data[DOMAIN].get(entry.entry_id)
    if coordinator:
        await coordinator.restart()


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator: SmsCoordinator = hass.data[DOMAIN].pop(entry.entry_id, None)
    if coordinator:
        await coordinator.stop()
    if not hass.data[DOMAIN]:
        try:
            async_remove_panel(hass, PANEL_URL)
        except KeyError:
            pass
    return True


async def _register_panel(hass: HomeAssistant) -> None:
    frontend_dir = Path(__file__).parent / FRONTEND_PATH
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            f"/{PANEL_URL}/{FRONTEND_PATH}",
            str(frontend_dir),
            cache_headers=False,
        )
    ])
    try:
        async_remove_panel(hass, PANEL_URL)
    except KeyError:
        pass
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL,
        config={
            "_panel_custom": {
                "name": "sms-gammu-panel",
                "module_url": f"/{PANEL_URL}/{FRONTEND_PATH}/panel.js",
            }
        },
        require_admin=False,
    )


class SmsCoordinator:
    """Фоновый опросчик с буферизацией multipart SMS."""

    def __init__(self, hass, entry, store, client):
        self.hass = hass
        self.entry = entry
        self.store = store
        self.client = client
        self._task: asyncio.Task | None = None
        # Буфер: ключ = (number, date), значение = {"parts": [...], "last_seen": float}
        self._buffer: dict[tuple, dict] = {}

    @property
    def _interval(self) -> int:
        return self.entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL)

    @property
    def _notify_targets(self) -> list[str]:
        return self.entry.data.get(CONF_NOTIFY_TARGETS, [])

    async def start(self) -> None:
        self._task = self.hass.async_create_background_task(
            self._loop(), f"{DOMAIN}_poll"
        )

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def restart(self) -> None:
        await self.stop()
        self.client = GatewayClient(self.entry.data)
        await self.start()

    async def _loop(self) -> None:
        _LOGGER.debug("SMS poll loop started, interval=%ss", self._interval)
        while True:
            try:
                await self._poll()
                await self._flush_ready()
            except Exception as e:
                _LOGGER.error("Poll error: %s", e)
            await asyncio.sleep(self._interval)

    async def _poll(self) -> None:
        """Читаем все SMS с симки, кладём в буфер, удаляем с симки."""
        messages = await self.client.get_all_sms()
        if not messages:
            return

        now = asyncio.get_event_loop().time()

        for msg in messages:
            number = msg.get("Number", "Unknown")
            text = msg.get("Text", "")
            date = msg.get("Date", "")
            sim_id = msg.get("id") or msg.get("Id") or msg.get("ID")

            if not text:
                continue

            key = (number, date)
            if key not in self._buffer:
                self._buffer[key] = {"parts": [], "last_seen": now, "sim_ids": []}

            existing_texts = [p["text"] for p in self._buffer[key]["parts"]]
            if text not in existing_texts:
                self._buffer[key]["parts"].append({"text": text, "sim_id": sim_id})
                self._buffer[key]["last_seen"] = now
                _LOGGER.debug(
                    "Buffered part from %s (parts=%d)", number, len(self._buffer[key]["parts"])
                )
                if sim_id is not None:
                    await self.client.delete_sms(int(sim_id))
            else:
                _LOGGER.debug("Skipped duplicate part from %s", number)
                if sim_id is not None:
                    await self.client.delete_sms(int(sim_id))

    async def _flush_ready(self) -> None:
        """Собираем SMS из буфера которые не менялись MULTIPART_WAIT секунд."""
        now = asyncio.get_event_loop().time()
        ready_keys = [
            key for key, buf in self._buffer.items()
            if now - buf["last_seen"] >= MULTIPART_WAIT
        ]

        for key in ready_keys:
            buf = self._buffer.pop(key)
            number, date = key
            parts = buf["parts"]

            # Склеиваем все части в порядке поступления
            full_text = "".join(p["text"] for p in parts)

            _LOGGER.info(
                "SMS assembled from %s: %d parts, %d chars",
                number, len(parts), len(full_text)
            )

            msg_id = await self.hass.async_add_executor_job(
                self.store.add, number, full_text, date
            )

            if msg_id:
                await self._notify(number, full_text)

    async def _notify(self, number: str, text: str) -> None:
        targets = self._notify_targets
        if not targets:
            return
        message = f"От: {number}\nТекст: {text}"
        for target in targets:
            parts = target.split(".", 1)
            if len(parts) != 2:
                continue
            try:
                await self.hass.services.async_call(
                    parts[0], parts[1],
                    {"title": "Новое SMS", "message": message},
                    blocking=False,
                )
            except Exception as e:
                _LOGGER.warning("Notify %s failed: %s", target, e)


class SmsApiView(HomeAssistantView):
    url = "/api/sms_gammu_viewer/{action:.*}"
    name = "api:sms_gammu_viewer"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    def _coordinator(self) -> SmsCoordinator | None:
        entries = self.hass.data.get(DOMAIN, {})
        if not entries:
            return None
        return next(iter(entries.values()))

    async def get(self, request: web.Request, action: str) -> web.Response:
        coord = self._coordinator()
        if not coord:
            return self._error("Not configured", 503)

        store = coord.store

        if action == "contacts":
            data = await self.hass.async_add_executor_job(store.get_contacts)
            return self._json(data)

        if action.startswith("messages/"):
            number = action[len("messages/"):]
            data = await self.hass.async_add_executor_job(store.get_by_number, number)
            return self._json(data)

        if action == "messages":
            data = await self.hass.async_add_executor_job(store.get_all)
            return self._json(data)

        if action == "status":
            client = coord.client
            signal = await client.get_signal()
            network = await client.get_network()
            modem = await client.get_modem()
            unread = await self.hass.async_add_executor_job(store.unread_count)
            buffered = len(coord._buffer)
            return self._json({
                "signal": signal,
                "network": network,
                "modem": modem,
                "unread": unread,
                "buffered_conversations": buffered,
            })

        if action == "poll_interval":
            return self._json({"interval": coord._interval})

        return self._error("Unknown action", 404)

    async def post(self, request: web.Request, action: str) -> web.Response:
        coord = self._coordinator()
        if not coord:
            return self._error("Not configured", 503)

        store = coord.store

        if action.startswith("read/"):
            msg_id = int(action[len("read/"):])
            await self.hass.async_add_executor_job(store.mark_read, msg_id)
            return self._json({"ok": True})

        if action.startswith("delete/"):
            msg_id = int(action[len("delete/"):])
            await self.hass.async_add_executor_job(store.delete, msg_id)
            return self._json({"ok": True})

        if action.startswith("delete_contact/"):
            number = action[len("delete_contact/"):]
            await self.hass.async_add_executor_job(store.delete_by_number, number)
            return self._json({"ok": True})

        if action == "poll_now":
            self.hass.async_create_task(coord._poll())
            return self._json({"ok": True})

        return self._error("Unknown action", 404)

    def _json(self, data) -> web.Response:
        return web.Response(
            text=json.dumps(data, ensure_ascii=False, default=str),
            content_type="application/json",
        )

    def _error(self, msg: str, status: int = 400) -> web.Response:
        return web.Response(
            text=json.dumps({"error": msg}),
            status=status,
            content_type="application/json",
        )
