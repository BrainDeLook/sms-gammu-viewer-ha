"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import asyncio
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

COLLECT_INTERVAL  = 3   # секунды между опросами в режиме сбора
COLLECT_EMPTY_MAX = 10  # сколько пустых опросов подряд = SMS полностью получен


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
    coord = hass.data[DOMAIN].get(entry.entry_id)
    if coord:
        await coord.restart()


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coord = hass.data[DOMAIN].pop(entry.entry_id, None)
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


class NumberBuffer:
    """Буфер частей SMS от одного номера."""

    def __init__(self, number: str) -> None:
        self.number = number
        self.parts: list[str] = []       # тексты частей в порядке получения
        self.first_date: str = ""        # дата первой части

    def add(self, text: str, date: str) -> bool:
        """Добавляет часть. Возвращает True если текст новый."""
        if text in self.parts:
            return False
        # Проверяем что новая часть не является подстрокой уже накопленного
        assembled = "".join(self.parts)
        if text in assembled:
            return False
        self.parts.append(text)
        if not self.first_date:
            self.first_date = date
        return True

    @property
    def full_text(self) -> str:
        return "".join(self.parts)


class SmsCoordinator:
    """
    Два режима работы:

    ОБЫЧНЫЙ: ждём poll_interval секунд, делаем GET /sms.
    - Если пусто — снова ждём.
    - Если есть SMS — переходим в РЕЖИМ СБОРА.

    СБОР: опрашиваем каждые COLLECT_INTERVAL секунд.
    - Пришли новые части — добавляем в буфер, сбрасываем счётчик пустых.
    - Пусто — увеличиваем счётчик.
    - Достигли COLLECT_EMPTY_MAX пустых подряд — SMS собран, сохраняем.
    - Обычный таймер на паузе всё это время.
    """

    def __init__(self, hass, entry, store, client):
        self.hass = hass
        self.entry = entry
        self.store = store
        self.client: GatewayClient = client
        self._task: asyncio.Task | None = None
        self.collecting = False

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

    # ─── Главный цикл ───────────────────────────────────────────────

    async def _loop(self) -> None:
        _LOGGER.debug("Poll loop started, interval=%ss", self._interval)
        while True:
            try:
                await asyncio.sleep(self._interval)
                messages = await self._safe_get_all()
                if messages:
                    await self._collect(messages)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                _LOGGER.error("Poll loop error: %s", e)

    # ─── Режим сбора ────────────────────────────────────────────────

    async def _collect(self, first_batch: list[dict]) -> None:
        self.collecting = True
        _LOGGER.info("Collect mode: %d parts on SIM", len(first_batch))

        # Буферы по номеру
        buffers: dict[str, NumberBuffer] = {}
        self._add_to_buffers(buffers, first_batch)

        # Сразу удаляем с симки
        await self._safe_delete_all()

        empty_streak = 0

        while empty_streak < COLLECT_EMPTY_MAX:
            await asyncio.sleep(COLLECT_INTERVAL)

            messages = await self._safe_get_all()

            if not messages:
                empty_streak += 1
                _LOGGER.debug(
                    "Collect: empty %d/%d", empty_streak, COLLECT_EMPTY_MAX
                )
                continue

            got_new = self._add_to_buffers(buffers, messages)
            await self._safe_delete_all()

            if got_new:
                empty_streak = 0
                _LOGGER.debug("Collect: new parts arrived, reset counter")
            else:
                empty_streak += 1
                _LOGGER.debug(
                    "Collect: no new parts, empty %d/%d",
                    empty_streak, COLLECT_EMPTY_MAX,
                )

        # Сохраняем в БД и уведомляем
        for number, buf in buffers.items():
            full_text = buf.full_text
            _LOGGER.info(
                "SMS assembled from %s: %d parts, %d chars",
                number, len(buf.parts), len(full_text),
            )
            msg_id = await self.hass.async_add_executor_job(
                self.store.add, number, full_text, buf.first_date
            )
            if msg_id:
                await self._notify(number, full_text)

        self.collecting = False
        _LOGGER.debug("Collect mode done")

    def _add_to_buffers(
        self, buffers: dict[str, NumberBuffer], messages: list[dict]
    ) -> bool:
        got_new = False
        for msg in messages:
            number = msg.get("Number", "Unknown")
            text   = msg.get("Text", "")
            date   = msg.get("Date", "")
            if not text:
                continue
            if number not in buffers:
                buffers[number] = NumberBuffer(number)
            if buffers[number].add(text, date):
                got_new = True
        return got_new

    # ─── Вспомогательные методы ────────────────────────────────────

    async def _safe_get_all(self) -> list[dict]:
        try:
            return await self.client.get_all_sms()
        except Exception as e:
            _LOGGER.warning("get_all_sms failed: %s", e)
            return []

    async def _safe_delete_all(self) -> None:
        try:
            await self.client.delete_all_sms()
        except Exception as e:
            _LOGGER.warning("delete_all_sms failed: %s", e)

    async def _notify(self, number: str, text: str) -> None:
        targets = self._notify_targets
        if not targets:
            return
        preview = text if len(text) <= 150 else text[:150] + "…"
        message = f"От: {number}\nТекст: {preview}"
        for target in targets:
            parts = target.split(".", 1)
            if len(parts) != 2:
                continue
            try:
                await self.hass.services.async_call(
                    parts[0], parts[1],
                    {
                        "title": "Новое SMS",
                        "message": message,
                        "data": {
                            "url": "/sms-viewer",
                            "clickAction": "/sms-viewer",
                        },
                    },
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
            signal  = await coord.client.get_signal()
            network = await coord.client.get_network()
            modem   = await coord.client.get_modem()
            unread  = await self.hass.async_add_executor_job(store.unread_count)
            return self._json({
                "signal": signal,
                "network": network,
                "modem": modem,
                "unread": unread,
                "collecting": coord.collecting,
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
            if not coord.collecting:
                async def _manual_poll():
                    msgs = await coord._safe_get_all()
                    if msgs:
                        await coord._collect(msgs)
                self.hass.async_create_task(_manual_poll())
            return self._json({"ok": True, "collecting": coord.collecting})

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
