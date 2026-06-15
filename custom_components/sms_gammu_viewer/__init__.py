"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

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
    CONF_NOTIFY_TARGETS,
    CONF_POLL_INTERVAL,
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

# Сколько секунд ждать после последней части перед сохранением
ASSEMBLY_TIMEOUT = 25


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

    if len(hass.data[DOMAIN]) == 1:
        await _register_panel(hass)

    hass.http.register_view(SmsApiView(hass))
    await coordinator.start()
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    _LOGGER.info("SMS Gammu Viewer started: %s", entry.title)
    return True


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    coord: SmsCoordinator = hass.data[DOMAIN].get(entry.entry_id)
    if coord:
        await coord.restart()


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coord: SmsCoordinator = hass.data[DOMAIN].pop(entry.entry_id, None)
    if coord:
        await coord.stop()
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


class SmsSession:
    """Сессия сборки SMS от одного номера."""

    def __init__(self, number: str) -> None:
        self.number = number
        # Список частей: {"text": str, "date": str}
        self.parts: list[dict] = []
        self.last_update: float = 0.0

    def add_part(self, text: str, date: str, now: float) -> bool:
        """Добавляет часть если она новая. Возвращает True если добавлено."""
        if any(p["text"] == text for p in self.parts):
            return False
        self.parts.append({"text": text, "date": date})
        self.last_update = now
        return True

    @property
    def assembled_text(self) -> str:
        return "".join(p["text"] for p in self.parts)

    @property
    def date(self) -> str:
        return self.parts[0]["date"] if self.parts else ""

    def is_ready(self, now: float) -> bool:
        return bool(self.parts) and (now - self.last_update) >= ASSEMBLY_TIMEOUT


class SmsCoordinator:
    """Фоновый опросчик с посессионной сборкой multipart SMS."""

    def __init__(self, hass, entry, store, client):
        self.hass = hass
        self.entry = entry
        self.store = store
        self.client = client
        self._task: asyncio.Task | None = None
        # Активные сессии: number -> SmsSession
        self._sessions: dict[str, SmsSession] = {}

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
        _LOGGER.debug("Poll loop started, interval=%ss", self._interval)
        while True:
            try:
                await self._poll()
                await self._flush_ready()
            except Exception as e:
                _LOGGER.error("Poll error: %s", e)
            await asyncio.sleep(self._interval)

    async def _poll(self) -> None:
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

            # Одна активная сессия на номер
            if number not in self._sessions:
                self._sessions[number] = SmsSession(number)

            session = self._sessions[number]
            added = session.add_part(text, date, now)

            if added:
                _LOGGER.debug(
                    "Part added for %s: %d parts total, len=%d",
                    number, len(session.parts), len(text)
                )
            else:
                _LOGGER.debug("Duplicate part skipped for %s", number)

        # Удаляем все SMS с симки после того как забрали их в буфер
        deleted = await self.client.delete_all_sms()
        if deleted:
            _LOGGER.debug("Cleared all SMS from modem after buffering %d messages", len(messages))
        else:
            _LOGGER.warning("Failed to delete SMS from modem")

    async def _flush_ready(self) -> None:
        """Сохраняем сессии которые не получали новых частей ASSEMBLY_TIMEOUT секунд."""
        now = asyncio.get_event_loop().time()
        ready = [
            number for number, s in self._sessions.items()
            if s.is_ready(now)
        ]

        for number in ready:
            session = self._sessions.pop(number)
            full_text = session.assembled_text
            date = session.date

            _LOGGER.info(
                "Saving SMS from %s: %d parts, %d chars",
                number, len(session.parts), len(full_text)
            )

            msg_id = await self.hass.async_add_executor_job(
                self.store.add, number, full_text, date
            )

            if msg_id:
                _LOGGER.info("Saved new SMS id=%s from %s", msg_id, number)
                await self._notify(number, full_text)
            else:
                _LOGGER.debug("Duplicate SMS skipped for %s", number)

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
            signal = await coord.client.get_signal()
            network = await coord.client.get_network()
            modem = await coord.client.get_modem()
            unread = await self.hass.async_add_executor_job(store.unread_count)
            return self._json({
                "signal": signal,
                "network": network,
                "modem": modem,
                "unread": unread,
                "active_sessions": len(coord._sessions),
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
