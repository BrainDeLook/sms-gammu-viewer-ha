"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path

import aiohttp
from aiohttp import web

from homeassistant.components import websocket_api
from homeassistant.components.frontend import (
    add_extra_js_url,
    async_register_built_in_panel,
    async_remove_panel,
    remove_extra_js_url,
)
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_CALL_DEVICE,
    CONF_COLLECT_EMPTY_MAX,
    CONF_LANGUAGE,
    CONF_SHOW_PANEL,
    CONF_SHOW_SIDEBAR_BADGE,
    DEFAULT_LANGUAGE,
    DEFAULT_SHOW_PANEL,
    DEFAULT_SHOW_SIDEBAR_BADGE,
    CONF_COLLECT_INTERVAL,
    CONF_NOTIFY_TARGETS,
    CONF_POLL_INTERVAL,
    DB_FILENAME,
    DEFAULT_COLLECT_EMPTY_MAX,
    DEFAULT_COLLECT_INTERVAL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
    EVENT_SMS_RECEIVED,
    EVENT_SMS_SENT,
    FRONTEND_PATH,
    NOTIFY_ACTION_REPLY_PREFIX,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
)
from .gateway import GatewayClient
from .raw_sms_pipeline import assemble_raw_parts, parse_raw_gateway_parts
from .sms_pipeline import (
    LogicalSms,
    SnapshotStabilizer,
    parse_gateway_messages,
    parse_lean_queue,
    snapshots_equal,
)
from .store import SmsStore

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

MODEM_ERROR_RESET_THRESHOLD = 5  # После N ошибок подряд — сброс модема
MODEM_RESET_COOLDOWN = 120       # Пауза после сброса (секунды)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    _register_sidebar_badge_websocket(hass)
    return True


def _register_sidebar_badge_websocket(hass: HomeAssistant) -> None:
    """Expose the unread count to the authenticated HA frontend."""

    @websocket_api.websocket_command({
        "type": f"{DOMAIN}/sidebar_badge",
    })
    @websocket_api.async_response
    async def websocket_sidebar_badge(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
    ) -> None:
        entries = hass.data.get(DOMAIN, {})
        coord = next(iter(entries.values()), None)
        if coord is None:
            connection.send_result(msg["id"], {"enabled": False, "unread": 0})
            return

        enabled = (
            coord.entry.data.get(
                CONF_SHOW_SIDEBAR_BADGE, DEFAULT_SHOW_SIDEBAR_BADGE
            )
            and coord.entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)
        )
        if not enabled:
            connection.send_result(msg["id"], {"enabled": False, "unread": 0})
            return

        try:
            unread = await hass.async_add_executor_job(coord.store.unread_count)
        except Exception as exc:
            _LOGGER.debug("Sidebar badge unread count failed: %s", exc)
            unread = 0
        connection.send_result(
            msg["id"], {"enabled": True, "unread": max(0, int(unread or 0))}
        )

    websocket_api.async_register_command(hass, websocket_sidebar_badge)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    db_path = Path(hass.config.config_dir) / DB_FILENAME
    store = SmsStore(db_path)
    await hass.async_add_executor_job(store.init)

    client = GatewayClient(hass, entry.data)
    coordinator = SmsCoordinator(hass, entry, store, client)
    hass.data[DOMAIN][entry.entry_id] = coordinator

    is_first = len(hass.data[DOMAIN]) == 1
    if is_first:
        # Карточка и статика регистрируются всегда, панель — по настройке
        await _register_frontend(hass)
        show_panel = entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)
        if show_panel:
            await _register_panel(hass)
        await _register_services(hass)

    hass.http.register_view(SmsApiView(hass))
    await coordinator.start()
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor", "cover", "button"])
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    # Ответ на SMS прямо из мобильного уведомления: companion-приложение
    # шлёт mobile_app_notification_action с введённым текстом (reply_text)
    async def _on_notification_action(event) -> None:
        action = event.data.get("action") or ""
        if not action.startswith(NOTIFY_ACTION_REPLY_PREFIX):
            return
        number = action[len(NOTIFY_ACTION_REPLY_PREFIX):]
        text = (event.data.get("reply_text") or "").strip()
        if not number or not text:
            return
        if await coordinator.send_sms(number, text):
            _LOGGER.info("Reply SMS sent to %s from notification", number)
        else:
            _LOGGER.warning("Reply SMS to %s from notification failed", number)

    entry.async_on_unload(
        hass.bus.async_listen("mobile_app_notification_action", _on_notification_action)
    )

    # Прогреваем кеш статуса при старте
    await coordinator.refresh_status_cache()

    _LOGGER.info("SMS Gammu Viewer started: %s", entry.title)
    return True


async def _register_services(hass: HomeAssistant) -> None:
    """Регистрирует sms_gammu_viewer.send_sms и sms_gammu_viewer.call."""
    import voluptuous as vol
    from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
    from homeassistant.helpers import config_validation as cv
    from .dialer import hangup as hangup_call, DialError, validate_phone_number
    from .const import (
        CONF_CALL_DIAL_TIMEOUT, CONF_CALL_DURATION,
        DEFAULT_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DURATION, EVENT_CALL_ENDED,
    )

    def _get_coord():
        entries = hass.data.get(DOMAIN, {})
        if not entries:
            raise ServiceValidationError("Интеграция SMS Gammu Viewer не настроена")
        return next(iter(entries.values()))

    async def _handle_send_sms(call) -> None:
        number = call.data.get("number", "").strip()
        message = call.data.get("message", "").strip()
        if not number:
            raise ServiceValidationError("Поле number обязательно")
        if not message:
            raise ServiceValidationError("Поле message обязательно")

        coord = _get_coord()
        ok = await coord.send_sms(number, message)
        if not ok:
            raise HomeAssistantError(f"Не удалось отправить SMS на {number}")
        _LOGGER.info("SMS sent to %s via send_sms service", number)

    async def _handle_call(call) -> None:
        number = call.data.get("number", "").strip()
        if not number:
            raise ServiceValidationError("Поле number обязательно")

        coord = _get_coord()
        call_device = coord.entry.data.get(CONF_CALL_DEVICE, "").strip()
        if not call_device:
            raise ServiceValidationError("Голосовой порт не настроен в интеграции")

        try:
            validate_phone_number(number)
        except DialError as e:
            raise ServiceValidationError(str(e)) from e

        dial_timeout = coord.entry.data.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT)
        call_duration = coord.entry.data.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION)

        _LOGGER.info("Calling +%s via call service...", number)
        reason = await coord.dial(
            call_device, number,
            dial_timeout_sec=dial_timeout, call_duration_sec=call_duration,
        )
        hass.bus.async_fire(EVENT_CALL_ENDED, {"phone_number": number, "reason": reason.value})
        await hass.async_add_executor_job(coord.store.add_call, number, reason.value)
        coord.push_event("call_ended", {"number": number, "reason": reason.value})
        _LOGGER.info("Call to +%s ended: %s", number, reason.value)

    async def _handle_hangup(call) -> None:
        coord = _get_coord()
        call_device = coord.entry.data.get(CONF_CALL_DEVICE, "").strip()
        if not call_device:
            raise ServiceValidationError("Голосовой порт не настроен в интеграции")
        await hangup_call(call_device)

    hass.services.async_register(
        DOMAIN, "send_sms", _handle_send_sms,
        schema=vol.Schema({
            vol.Required("number"): cv.string,
            vol.Required("message"): cv.string,
        }),
    )

    hass.services.async_register(
        DOMAIN, "call", _handle_call,
        schema=vol.Schema({
            vol.Required("number"): cv.string,
        }),
    )

    hass.services.async_register(DOMAIN, "hangup", _handle_hangup, schema=vol.Schema({}))


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    # ВАЖНО: НЕ делаем async_reload(entry.entry_id) здесь — это ломает
    # регистрацию sidebar-панели (она привязана к первому запуску setup
    # и не переживает полную перезагрузку entry чисто), вызывая бесконечный
    # цикл "Removing unknown panel" + постоянные рестарты poll loop.
    #
    # Вместо этого перезапускаем координатор (подхватывает poll interval,
    # notify targets и т.д.) И отдельно перегружаем ТОЛЬКО платформы
    # cover/button — это даёт им заново вызвать async_setup_entry с
    # актуальным списком call_entities, без затрагивания панели/сенсора.
    coord = hass.data[DOMAIN].get(entry.entry_id)
    if coord:
        await coord.restart()

    # Обновляем видимость панели в сайдбаре
    show_panel = entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)
    try:
        if show_panel:
            await _register_panel(hass)
        else:
            try:
                async_remove_panel(hass, PANEL_URL)
            except KeyError:
                pass
    except Exception as e:
        _LOGGER.warning("Failed to update panel visibility: %s", e)

    try:
        await hass.config_entries.async_unload_platforms(entry, ["cover", "button"])
        await hass.config_entries.async_forward_entry_setups(entry, ["cover", "button"])
    except Exception as e:
        _LOGGER.warning(
            "Failed to reload cover/button platforms after options change: %s. "
            "Restart Home Assistant manually to pick up call entity changes.",
            e,
        )


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await hass.config_entries.async_unload_platforms(entry, ["sensor", "cover", "button"])
    coord = hass.data[DOMAIN].pop(entry.entry_id, None)
    if coord:
        await coord.stop()
    if not hass.data[DOMAIN]:
        try:
            async_remove_panel(hass, PANEL_URL)
        except KeyError:
            pass
        try:
            remove_extra_js_url(hass, await _card_url(hass))
        except (KeyError, ValueError):
            pass
        try:
            remove_extra_js_url(hass, await _sidebar_badge_url(hass))
        except (KeyError, ValueError):
            pass
        hass.data.pop(_FRONTEND_REGISTERED, None)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Интеграцию удалили совсем — подчищаем Lovelace-ресурс карточки,
    иначе на дашбордах останется битая ссылка на несуществующий модуль."""
    try:
        resources = _lovelace_resources(hass)
        if resources is None or not hasattr(resources, "async_delete_item"):
            return
        if not getattr(resources, "loaded", True):
            await resources.async_load()
            resources.loaded = True
        for item in list(resources.async_items()):
            if _is_card_resource(item.get("url") or ""):
                await resources.async_delete_item(item["id"])
                _LOGGER.info("Lovelace resource removed: %s", item.get("url"))
    except Exception as e:
        _LOGGER.debug("Lovelace resource cleanup failed: %s", e)


_FRONTEND_REGISTERED = f"{DOMAIN}_frontend_registered"

# Карточка отдаётся через /api-путь, а не через кастомную статику:
# 1) /api/* гарантированно проходит через любой reverse-proxy / Nabu Casa —
#    иначе бы у пользователя не работал сам HA;
# 2) ответ идёт с Cache-Control: no-cache — WebView companion-приложения
#    обязан ревалидировать файл и не может залипнуть на старой копии.
CARD_JS_BASE = "/api/sms_gammu_viewer_static/card.js"
CARD_FILENAME = "sms-gammu-viewer-card.js"
SIDEBAR_BADGE_FILENAME = "sidebar-badge.js"


class CardJsView(HomeAssistantView):
    """Раздача JS-модуля карточки без авторизации (публичный статический
    ресурс, как /static или /hacsfiles)."""

    url = CARD_JS_BASE
    name = "api:sms_gammu_viewer:card_js"
    requires_auth = False

    async def get(self, request: web.Request) -> web.FileResponse:
        card_path = Path(__file__).parent / FRONTEND_PATH / CARD_FILENAME
        return web.FileResponse(
            card_path,
            headers={
                "Cache-Control": "no-cache, must-revalidate",
                "Content-Type": "application/javascript; charset=utf-8",
            },
        )


async def _integration_version(hass: HomeAssistant) -> str:
    from homeassistant.loader import async_get_integration
    integration = await async_get_integration(hass, DOMAIN)
    return str(integration.version)


async def _card_url(hass: HomeAssistant) -> str:
    """URL карточки с версией интеграции — после каждого обновления фронтенд
    видит новый URL и гарантированно перечитывает файл вместо кешированного.
    """
    version = await _integration_version(hass)
    return f"{CARD_JS_BASE}?v={version}"


async def _sidebar_badge_url(hass: HomeAssistant) -> str:
    version = await _integration_version(hass)
    return f"/{PANEL_URL}/{FRONTEND_PATH}/{SIDEBAR_BADGE_FILENAME}?v={version}"


async def _register_frontend(hass: HomeAssistant) -> None:
    """Статика + Lovelace-карточка. Отдельно от панели: карточка должна
    работать и при выключенной панели в сайдбаре.
    """
    if hass.data.get(_FRONTEND_REGISTERED):
        return
    frontend_dir = Path(__file__).parent / FRONTEND_PATH
    try:
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                f"/{PANEL_URL}/{FRONTEND_PATH}",
                str(frontend_dir),
                cache_headers=False,
            )
        ])
    except Exception as e:
        # Путь уже зарегистрирован (повторный setup без рестарта HA)
        _LOGGER.debug("Static path already registered: %s", e)
    hass.http.register_view(CardJsView())
    card_url = await _card_url(hass)
    # Основной механизм — Lovelace-ресурс (как у HACS): список ресурсов
    # фронтенд запрашивает через websocket при каждой загрузке дашборда,
    # поэтому карточка грузится даже когда приложение держит закешированный
    # index.html. extra_js_url оставляем как fallback для YAML-режима
    # Lovelace, где программная запись ресурсов невозможна.
    add_extra_js_url(hass, card_url)
    add_extra_js_url(hass, await _sidebar_badge_url(hass))
    await _register_card_resource(hass)
    _LOGGER.info("Card frontend registered: %s", card_url)
    hass.data[_FRONTEND_REGISTERED] = True


def _lovelace_resources(hass: HomeAssistant):
    """Коллекция Lovelace-ресурсов (storage-режим) или None."""
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    return resources


def _is_card_resource(url: str) -> bool:
    """Любая форма ссылки на нашу карточку: старая статика, /api-путь,
    ручные записи пользователя с произвольным ?v=."""
    base = (url or "").split("?")[0]
    return CARD_FILENAME in base or base == CARD_JS_BASE


async def _register_card_resource(hass: HomeAssistant) -> None:
    """Добавляет/обновляет карточку в Settings → Dashboards → Resources.

    Все прежние варианты записи (старый путь статики, ручные ресурсы)
    мигрируются на актуальный URL, дубликаты удаляются — иначе модуль
    грузится дважды и второй define падает.
    """
    desired = await _card_url(hass)
    try:
        resources = _lovelace_resources(hass)
        if resources is None:
            _LOGGER.warning("Lovelace resources unavailable, card resource not registered")
            return
        if not getattr(resources, "loaded", True):
            await resources.async_load()
            resources.loaded = True
        if not hasattr(resources, "async_create_item"):
            # YAML-режим Lovelace: ресурсы только руками, работает fallback
            # через extra_js_url
            _LOGGER.warning(
                "Lovelace is in YAML mode — add the card resource manually: %s",
                desired,
            )
            return
        found = False
        for item in list(resources.async_items()):
            url = item.get("url") or ""
            if not _is_card_resource(url):
                continue
            if not found:
                found = True
                if url != desired:
                    await resources.async_update_item(item["id"], {"url": desired})
                    _LOGGER.info("Lovelace resource migrated: %s -> %s", url, desired)
                else:
                    _LOGGER.info("Lovelace resource already registered: %s", desired)
            else:
                await resources.async_delete_item(item["id"])
                _LOGGER.info("Duplicate card resource removed: %s", url)
        if not found:
            await resources.async_create_item({"res_type": "module", "url": desired})
            _LOGGER.info("Lovelace resource registered: %s", desired)
    except Exception as e:
        _LOGGER.warning("Could not register Lovelace resource: %s", e)


async def _register_panel(hass: HomeAssistant) -> None:
    await _register_frontend(hass)
    version = await _integration_version(hass)
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
                # ?v= — сброс кеша фронтенда при каждом обновлении интеграции
                "module_url": f"/{PANEL_URL}/{FRONTEND_PATH}/panel.js?v={version}",
                # The panel owns its viewport height and safe-area padding.
                # This avoids HA's custom-panel wrapper changing its sizing.
                "handle_safe_area": True,
            }
        },
        require_admin=False,
    )


WAP_PUSH_MARKERS = (
    "application/vnd.wap.mms-message",
    "application/vnd.wap.sic",
    "application/vnd.wap.slc",
    "x-wap-application:mms.ua",
)


def _looks_like_wap_push(text: str) -> bool:
    """Определяет служебные WAP Push / MMS-уведомления (бинарный WBXML),
    которые Gammu иногда отдаёт как сырой текст вместо настоящего SMS.
    """
    if not text:
        return False
    if any(marker in text for marker in WAP_PUSH_MARKERS):
        return True
    # WBXML обычно начинается с управляющих байт \x00-\x1f в большом количестве
    control_chars = sum(1 for c in text[:40] if ord(c) < 9 or 13 < ord(c) < 32)
    return control_chars >= 5


class SmsCoordinator:
    def __init__(self, hass, entry, store, client):
        self.hass = hass
        self.entry = entry
        self.store: SmsStore = store
        self.client: GatewayClient = client
        self._task: asyncio.Task | None = None
        self.collecting = False
        self._error_streak = 0
        self._last_event_id = 0
        self._events: list[dict] = []  # SSE события для фронтенда
        self._last_reset_at: float = 0.0
        self._modem_ok: bool = True
        self._sensor_listeners: list = []
        # Многие модемы делят один процессор между голосовым и SMS-каналом —
        # во время активного звонка опрос /sms может временно не отвечать.
        # call/cover/button сущности выставляют этот флаг перед дозвоном и
        # снимают по завершении, чтобы не тратить циклы опроса впустую.
        self.call_in_progress: bool = False
        self._status_cache: dict | None = None
        # Пока идёт отправка SMS — приостанавливаем опрос модема,
        # чтобы gateway не был занят двумя запросами одновременно
        self.send_in_progress: bool = False
        # Serial-порт не переживает два параллельных звонка — все дозвоны
        # (cover/button/сервис/API) идут через этот lock по очереди
        self.dial_lock = asyncio.Lock()

    @property
    def _interval(self) -> int:
        return self.entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL)

    @property
    def _collect_interval(self) -> int:
        return self.entry.data.get(CONF_COLLECT_INTERVAL, DEFAULT_COLLECT_INTERVAL)

    @property
    def _collect_empty_max(self) -> int:
        return self.entry.data.get(CONF_COLLECT_EMPTY_MAX, DEFAULT_COLLECT_EMPTY_MAX)

    @property
    def _notify_targets(self) -> list[str]:
        return self.entry.data.get(CONF_NOTIFY_TARGETS, [])

    def register_sensor_listener(self, callback_fn) -> None:
        self._sensor_listeners.append(callback_fn)

    def unregister_sensor_listener(self, callback_fn) -> None:
        if callback_fn in self._sensor_listeners:
            self._sensor_listeners.remove(callback_fn)

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
        self.client = GatewayClient(self.hass, self.entry.data)
        await self.start()

    @property
    def status_cache(self) -> dict | None:
        return self._status_cache

    async def refresh_status_cache(self) -> None:
        """Полное обновление кеша статуса (signal/network/modem/sim/capacity)."""
        try:
            _s, _n, _m, _si, _cap = await asyncio.gather(
                self.client.get_signal(),
                self.client.get_network(),
                self.client.get_modem(),
                self.client.get_sim(),
                self.client.get_sms_capacity(),
                return_exceptions=True,
            )
            self._status_cache = {
                "signal":   None if isinstance(_s,   Exception) else _s,
                "network":  None if isinstance(_n,   Exception) else _n,
                "modem":    None if isinstance(_m,   Exception) else _m,
                "sim":      None if isinstance(_si,  Exception) else _si,
                "capacity": None if isinstance(_cap, Exception) else _cap,
                "call_enabled": bool(self.entry.data.get(CONF_CALL_DEVICE, "").strip()),
                "language":   self.entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE),
                "show_panel": self.entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL),
            }
            _LOGGER.debug("Status cache refreshed")
        except Exception as e:
            _LOGGER.debug("Status cache refresh failed: %s", e)

    async def send_sms(self, number: str, text: str) -> bool:
        """Отправляет SMS и, при успехе, сохраняет исходящее в историю чата,
        шлёт событие new_message фронтенду и sms_sent в шину HA.
        Используется сервисом send_sms, API панели и ответом из уведомления.
        """
        self.send_in_progress = True
        try:
            ok = await self.client.send_sms(number, text)
        finally:
            self.send_in_progress = False
        if not ok:
            return False
        msg_id = await self.hass.async_add_executor_job(
            self.store.add_outgoing, number, text
        )
        if msg_id:
            self.push_event("new_message", {
                "id": msg_id, "number": number, "text": text,
                "date": datetime.now().isoformat(timespec="seconds"),
                "is_read": 1, "direction": "out",
            })
        self.hass.bus.async_fire(EVENT_SMS_SENT, {"number": number, "message": text})
        return True

    async def dial(self, device_path: str, number: str, *,
                   dial_timeout_sec: int, call_duration_sec: int):
        """Дозвон через общий lock: параллельные звонки выстраиваются
        в очередь вместо одновременного открытия serial-порта.
        hangup намеренно идёт мимо lock — он должен уметь прервать
        текущий звонок.
        """
        from .dialer import dial_number
        async with self.dial_lock:
            self.call_in_progress = True
            try:
                return await dial_number(
                    device_path, number,
                    dial_timeout_sec=dial_timeout_sec,
                    call_duration_sec=call_duration_sec,
                )
            finally:
                self.call_in_progress = False

    def push_event(self, event_type: str, data: dict) -> None:
        self._last_event_id += 1
        self._events.append({
            "id": self._last_event_id,
            "type": event_type,
            "data": data,
        })
        if len(self._events) > 100:
            self._events = self._events[-100:]
        for listener in list(self._sensor_listeners):
            try:
                listener(event_type, data)
            except Exception as e:
                _LOGGER.debug("Sensor listener error: %s", e)

    def get_events_since(self, last_id: int) -> list[dict]:
        return [e for e in self._events if e["id"] > last_id]

    async def _loop(self) -> None:
        _LOGGER.debug("Poll loop started, interval=%ss", self._interval)
        while True:
            try:
                await asyncio.sleep(self._interval)
                if self.call_in_progress:
                    _LOGGER.debug("Skipping SMS poll — call in progress")
                    continue
                if self.send_in_progress:
                    _LOGGER.debug("Skipping SMS poll — send in progress")
                    continue

                # The lean gateway owns multipart assembly and exposes a
                # durable logical queue. Only probe raw/legacy endpoints when
                # the v1 API explicitly returns 404; never fall back after a
                # transient v1 error because that could consume the same SMS
                # through two protocols.
                lean_supported, queued_messages = await self._safe_get_lean()
                if lean_supported:
                    if queued_messages:
                        await self._collect_lean(queued_messages)
                else:
                    raw_supported, raw_messages = await self._safe_get_raw()
                    if raw_supported:
                        if raw_messages:
                            await self._collect_raw(raw_messages)
                    else:
                        messages = await self._safe_get_all()
                        if messages:
                            self._error_streak = 0
                            await self._collect(messages)
                        elif messages is not None:
                            self._error_streak = 0
                # Обновляем кеш статуса в фоне каждый цикл
                try:
                    _s, _n = await asyncio.gather(
                        self.client.get_signal(),
                        self.client.get_network(),
                        return_exceptions=True,
                    )
                    if self._status_cache is None:
                        self._status_cache = {}
                    if not isinstance(_s, Exception):
                        self._status_cache["signal"] = _s
                    if not isinstance(_n, Exception):
                        self._status_cache["network"] = _n
                except Exception:
                    pass
            except asyncio.CancelledError:
                raise
            except Exception as e:
                _LOGGER.error("Poll loop error: %s", e)

    async def _collect_lean(self, payload: list[dict]) -> None:
        """Persist and acknowledge immutable messages from the durable queue."""
        queued = parse_lean_queue(payload)
        if len(queued) != len(payload):
            _LOGGER.error(
                "Lean gateway returned %d invalid queue item(s)",
                len(payload) - len(queued),
            )
        for item in queued:
            stored = await self._save_logical_sms(item.message)
            if not stored:
                _LOGGER.error(
                    "Lean SMS was not confirmed in SQLite; leaving queue id=%s",
                    item.id,
                )
                continue
            try:
                acknowledged = await self.client.acknowledge_queued_message(
                    item.id
                )
            except Exception as error:
                await self._record_modem_failure("acknowledge_queued_message", error)
                continue
            if not acknowledged:
                _LOGGER.warning("Lean SMS queue ACK was rejected: id=%s", item.id)
            else:
                _LOGGER.info("Lean SMS queue ACK completed: id=%s", item.id[:12])

    async def _collect_raw(self, payload: list[dict]) -> None:
        """Persist proven raw-part assemblies, then ACK exact modem records."""
        parts = parse_raw_gateway_parts(payload)
        result = assemble_raw_parts(parts)

        if result.pending:
            _LOGGER.info(
                "Raw SMS: waiting for %d incomplete physical part(s)",
                len(result.pending),
            )
        if result.ambiguous:
            _LOGGER.error(
                "Raw SMS: quarantined %d ambiguous physical part(s); "
                "nothing will be joined or deleted",
                len(result.ambiguous),
            )

        for assembled in result.complete:
            stored = await self._save_logical_sms(
                LogicalSms(
                    number=assembled.number,
                    text=assembled.text,
                    date=assembled.date,
                )
            )
            if not stored:
                _LOGGER.error(
                    "Raw SMS was not confirmed in SQLite; leaving modem "
                    "locations untouched: %s",
                    assembled.locations,
                )
                continue
            try:
                acknowledged = await self.client.acknowledge_raw_sms(
                    assembled.locations, assembled.fingerprints
                )
            except Exception as error:
                await self._record_modem_failure("acknowledge_raw_sms", error)
                _LOGGER.exception(
                    "Raw SMS persisted but modem ACK request failed; locations=%s",
                    assembled.locations,
                )
                continue
            if not acknowledged:
                _LOGGER.warning(
                    "Raw SMS persisted but modem ACK was incomplete; the next "
                    "poll will safely deduplicate it"
                )

    async def _collect(self, first_batch: list[dict]) -> None:
        """Consume logical messages without re-linking Gammu's output.

        ``sms-gammu-gateway`` already runs ``gammu.LinkSMS`` and returns one
        REST item per logical message.  We keep those items independent, wait
        for either explicit ``Complete`` metadata or a stable snapshot, then
        pop and save each message atomically through ``/sms/getsms``.
        """
        self.collecting = True
        try:
            batch = first_batch
            while batch:
                stable, disappeared = await self._wait_for_stable_snapshot(batch)
                if not stable:
                    return

                if disappeared:
                    # Another gateway consumer removed the records. We cannot
                    # prove that the last observed text was complete, so do
                    # not persist or notify with a potentially truncated SMS.
                    _LOGGER.warning(
                        "SMS disappeared from gateway while collecting; "
                        "discarding an unconfirmed snapshot (%d logical messages)",
                        len(stable),
                    )
                    return

                _LOGGER.info(
                    "SMS snapshot stable: consuming %d logical message(s)",
                    len(stable),
                )
                # Pop exactly the number of messages in the confirmed snapshot.
                # The gateway deletes the physical Locations belonging to the
                # returned logical message inside the same request.
                for _ in range(len(stable)):
                    popped = await self.client.pop_first_sms()
                    if not popped:
                        _LOGGER.warning("Gateway returned no SMS while popping snapshot")
                        break
                    parsed = parse_gateway_messages([popped])
                    if parsed:
                        await self._save_logical_sms(parsed[0])

                # A message may have arrived while the confirmed snapshot was
                # being consumed. Process the remainder as a new snapshot.
                remainder = await self._safe_get_all()
                if not remainder:
                    return
                batch = remainder
        finally:
            self.collecting = False

    async def _wait_for_stable_snapshot(
        self, first_batch: list[dict]
    ) -> tuple[tuple[LogicalSms, ...], bool]:
        """Return a confirmed snapshot and whether it vanished externally."""
        stabilizer = SnapshotStabilizer(self._collect_empty_max)
        raw_messages = first_batch

        while True:
            messages = parse_gateway_messages(raw_messages)
            observation = stabilizer.observe(messages)
            if observation.ready:
                # Always confirm once more, even when the gateway explicitly
                # reports Complete=true, to close the read/delete race window.
                confirmation_raw = await self._safe_get_all()
                if confirmation_raw is None:
                    await asyncio.sleep(self._collect_interval)
                    continue
                confirmation = parse_gateway_messages(confirmation_raw)
                if not confirmation:
                    return observation.messages, True
                confirmed = stabilizer.observe(confirmation)
                if confirmed.ready and snapshots_equal(
                    observation.messages, confirmation
                ):
                    return confirmation, False
                raw_messages = confirmation_raw
                continue

            await asyncio.sleep(self._collect_interval)
            await self._wait_for_modem_idle()
            next_raw = await self._safe_get_all()
            if next_raw is None:
                continue
            if not next_raw:
                return stabilizer.last, True
            raw_messages = next_raw

    async def _wait_for_modem_idle(self) -> None:
        """Pause collection while another operation owns the modem."""
        if self.call_in_progress or self.send_in_progress:
            _LOGGER.debug("Collect: pausing for call/send operation")
        while self.call_in_progress or self.send_in_progress:
            await asyncio.sleep(1)

    async def _save_logical_sms(self, message: LogicalSms) -> bool:
        """Persist one already-linked gateway message without heuristically appending."""
        number = message.number
        text = message.text
        if _looks_like_wap_push(text):
            text = "📎 Входящий MMS (не поддерживается)"
        date = message.date
        msg_id = await self.hass.async_add_executor_job(
            self.store.add, number, text, date
        )
        if not msg_id:
            stored = await self.hass.async_add_executor_job(
                self.store.contains, number, text, date
            )
            if stored:
                _LOGGER.debug("Ignoring already stored SMS from %s at %s", number, date)
            return stored
        self.push_event("new_message", {
            "id": msg_id, "number": number,
            "text": text, "date": date, "is_read": 0
        })
        self.hass.bus.async_fire(EVENT_SMS_RECEIVED, {
            "number": number, "text": text, "date": date,
        })
        await self._notify(number, text)
        return True

    async def _safe_get_all(self) -> list[dict] | None:
        try:
            result = await self.client.get_all_sms()
            self._mark_modem_connected()
            return result
        except Exception as e:
            await self._record_modem_failure("get_all_sms", e)
            return None

    async def _safe_get_raw(self) -> tuple[bool, list[dict] | None]:
        """Return (API supported, payload); never fall back after raw API errors."""
        try:
            result = await self.client.get_raw_sms_parts()
            if result is None:
                return False, None
            self._mark_modem_connected()
            return True, result
        except Exception as e:
            await self._record_modem_failure("get_raw_sms_parts", e)
            return True, None

    async def _safe_get_lean(self) -> tuple[bool, list[dict] | None]:
        """Return (API supported, payload) without unsafe protocol fallback."""
        try:
            result = await self.client.get_queued_messages()
            if result is None:
                return False, None
            self._mark_modem_connected()
            return True, result
        except Exception as error:
            await self._record_modem_failure("get_queued_messages", error)
            return True, None

    def _mark_modem_connected(self) -> None:
        if not self._modem_ok:
            self._modem_ok = True
            self.push_event("modem_status", {"ok": True})
            _LOGGER.info("Modem connection restored")
        self._error_streak = 0

    async def _record_modem_failure(self, operation: str, error: Exception) -> None:
        import time

        self._error_streak += 1
        self._modem_ok = False
        _LOGGER.warning(
            "%s failed (%d/%d): %s",
            operation, self._error_streak, MODEM_ERROR_RESET_THRESHOLD, error,
        )
        self.push_event("modem_status", {
            "ok": False,
            "error": str(error),
            "streak": self._error_streak,
        })

        now = time.monotonic()
        if (self._error_streak >= MODEM_ERROR_RESET_THRESHOLD
                and now - self._last_reset_at > MODEM_RESET_COOLDOWN):
            _LOGGER.warning("Too many errors — resetting modem")
            self._last_reset_at = now
            try:
                await self.client.reset_modem()
                self._error_streak = 0
                _LOGGER.info("Modem reset command sent")
                await asyncio.sleep(15)
            except Exception as reset_error:
                _LOGGER.error("Modem reset failed: %s", reset_error)

    async def _notify(self, number: str, text: str) -> None:
        targets = self._notify_targets
        if not targets:
            return
        try:
            if await self.hass.async_add_executor_job(self.store.is_muted, number):
                _LOGGER.debug("Skipping notification: %s is muted", number)
                return
        except Exception as e:
            _LOGGER.debug("is_muted check failed: %s", e)

        # Имя из телефонной книги если есть, иначе сам номер/alphaTag
        try:
            contact = await self.hass.async_add_executor_job(self.store.get_contact, number)
            display_name = contact["name"] if contact else number
        except Exception:
            display_name = number

        preview = text if len(text) <= 150 else text[:150] + "…"

        # Уникальный тег по отправителю — SMS от разных номеров не заменяют друг друга,
        # от одного — заменяются (показывается только последнее)
        safe_tag = "".join(c for c in number if c.isalnum())
        notif_tag = f"sms_gammu_{safe_tag}"

        lang = self.entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)
        reply_title = "Ответить" if lang == "ru" else "Reply"
        open_title = "Открыть SMS" if lang == "ru" else "Open SMS"

        actions = []
        # Поле ответа показываем только для настоящих номеров — на alpha-tag
        # ("Bank", "Gov" и т.п.) отправить SMS всё равно нельзя
        if re.match(r"^\+?\d", number.strip()):
            actions.append({
                "action": f"{NOTIFY_ACTION_REPLY_PREFIX}{number}",
                "title": reply_title,
                "behavior": "textInput",
                "textInputButtonTitle": reply_title,
                "textInputPlaceholder": "SMS",
            })
        actions.append({
            "action": "URI",
            "title": open_title,
            "uri": "/sms-viewer",
        })

        for target in targets:
            parts = target.split(".", 1)
            if len(parts) != 2:
                continue
            try:
                await self.hass.services.async_call(
                    parts[0], parts[1],
                    {
                        "title": f"SMS: {display_name}",
                        "message": preview,
                        "data": {
                            "url": "/sms-viewer",
                            "tag": notif_tag,
                            "group": "sms_gammu_viewer",
                            "actions": actions,
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

    def _coord(self) -> SmsCoordinator | None:
        entries = self.hass.data.get(DOMAIN, {})
        return next(iter(entries.values())) if entries else None

    @staticmethod
    def _parse_int(value: str) -> int | None:
        """id из URL: None вместо ValueError (иначе мусор в URL даёт 500)."""
        try:
            return int(value)
        except ValueError:
            return None

    async def get(self, request: web.Request, action: str) -> web.Response:
        coord = self._coord()
        if not coord:
            return self._error("Not configured", 503)
        store = coord.store

        if action == "contacts":
            data = await self.hass.async_add_executor_job(store.get_contacts)
            return self._json(data)

        if action.startswith("messages/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("messages/"):])
            data = await self.hass.async_add_executor_job(store.get_messages_with_starred, number)
            return self._json(data)

        if action == "messages":
            data = await self.hass.async_add_executor_job(store.get_all)
            return self._json(data)

        if action == "db_stats":
            import os
            db_path = store._path
            db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
            msg_count = await self.hass.async_add_executor_job(store.get_message_count)
            return self._json({
                "db_size": db_size,
                "msg_count": msg_count,
            })

        if action == "status":
            unread = await self.hass.async_add_executor_job(store.unread_count)
            sim_phone_number = await self.hass.async_add_executor_job(
                store.get_setting, "sim_phone_number"
            )
            cache = coord.status_cache
            if cache is not None:
                # Обновляем кеш в фоне, отвечаем сразу из текущего
                self.hass.async_create_task(coord.refresh_status_cache())
                return self._json({
                    "signal":        cache.get("signal"),
                    "network":       cache.get("network"),
                    "modem":         cache.get("modem"),
                    "sim":           cache.get("sim"),
                    "capacity":      cache.get("capacity"),
                    "unread":        unread,
                    "sim_phone_number": sim_phone_number,
                    "collecting":    coord.collecting,
                    "error_streak":  coord._error_streak,
                    "call_enabled":  cache.get("call_enabled"),
                    "language":      cache.get("language"),
                    "show_panel":    cache.get("show_panel"),
                    "poll_interval_hint": coord._interval,
                    "cached": True,
                })
            # Кеша нет — первый запрос, ждём
            signal  = await coord.client.get_signal()
            network = await coord.client.get_network()
            modem   = await coord.client.get_modem()
            sim     = await coord.client.get_sim()
            capacity = await coord.client.get_sms_capacity()
            unread  = await self.hass.async_add_executor_job(store.unread_count)
            sim_phone_number = await self.hass.async_add_executor_job(
                store.get_setting, "sim_phone_number"
            )
            return self._json({
                "signal": signal,
                "network": network,
                "modem": modem,
                "sim": sim,
                "capacity": capacity,
                "unread": unread,
                "collecting": coord.collecting,
                "error_streak": coord._error_streak,
                "call_enabled": bool(coord.entry.data.get("call_device", "").strip()),
                "sim_phone_number": sim_phone_number,
                "language": coord.entry.data.get("language", "ru"),
            })

        if action == "poll_interval":
            return self._json({"interval": coord._interval})

        if action == "call_history":
            data = await self.hass.async_add_executor_job(store.get_call_history)
            return self._json(data)

        if action == "phonebook":
            data = await self.hass.async_add_executor_job(store.get_all_contacts)
            return self._json(data)

        if action.startswith("phonebook/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("phonebook/"):])
            data = await self.hass.async_add_executor_job(store.get_contact, number)
            if data is None:
                return self._error("Contact not found", 404)
            return self._json(data)

        if action == "check_call_port":
            call_device = coord.entry.data.get("call_device", "").strip()
            from .dialer import check_port
            result = await check_port(call_device)
            return self._json(result)

        if action.startswith("events"):
            last_id = self._parse_int(request.rel_url.query.get("since", "0")) or 0
            events = coord.get_events_since(last_id)
            return self._json({"events": events, "last_id": coord._last_event_id})

        if action.startswith("export/"):
            fmt = action[len("export/"):]
            return await self._export(store, fmt)

        return self._error("Unknown action", 404)

    async def post(self, request: web.Request, action: str) -> web.Response:
        coord = self._coord()
        if not coord:
            return self._error("Not configured", 503)
        store = coord.store

        if action.startswith("read/"):
            msg_id = self._parse_int(action[len("read/"):])
            if msg_id is None:
                return self._error("Invalid message id", 400)
            await self.hass.async_add_executor_job(store.mark_read, msg_id)
            coord.push_event("message_read", {"id": msg_id})
            return self._json({"ok": True})

        if action == "clear_storage":
            await self.hass.async_add_executor_job(store.clear_all)
            return self._json({"ok": True})

        if action.startswith("mark_read/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("mark_read/"):])
            await self.hass.async_add_executor_job(store.mark_read_by_number, number)
            coord.push_event("contact_read", {"number": number})
            return self._json({"ok": True})

        if action.startswith("star/"):
            msg_id = self._parse_int(action[len("star/"):])
            if msg_id is None:
                return self._error("Invalid message id", 400)
            await self.hass.async_add_executor_job(store.star_message, msg_id)
            return self._json({"ok": True})

        if action.startswith("unstar/"):
            msg_id = self._parse_int(action[len("unstar/"):])
            if msg_id is None:
                return self._error("Invalid message id", 400)
            await self.hass.async_add_executor_job(store.unstar_message, msg_id)
            return self._json({"ok": True})

        if action.startswith("pin/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("pin/"):])
            await self.hass.async_add_executor_job(store.pin_number, number)
            return self._json({"ok": True})

        if action.startswith("unpin/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("unpin/"):])
            await self.hass.async_add_executor_job(store.unpin_number, number)
            return self._json({"ok": True})

        if action.startswith("delete/"):
            msg_id = self._parse_int(action[len("delete/"):])
            if msg_id is None:
                return self._error("Invalid message id", 400)
            await self.hass.async_add_executor_job(store.delete, msg_id)
            coord.push_event("message_deleted", {"id": msg_id})
            return self._json({"ok": True})

        if action.startswith("delete_contact/"):
            number = action[len("delete_contact/"):]
            await self.hass.async_add_executor_job(store.delete_by_number, number)
            coord.push_event("contact_deleted", {"number": number})
            return self._json({"ok": True})

        if action.startswith("mute/"):
            number = action[len("mute/"):]
            await self.hass.async_add_executor_job(store.mute, number)
            coord.push_event("contact_muted", {"number": number, "muted": True})
            return self._json({"ok": True, "muted": True})

        if action.startswith("unmute/"):
            number = action[len("unmute/"):]
            await self.hass.async_add_executor_job(store.unmute, number)
            coord.push_event("contact_muted", {"number": number, "muted": False})
            return self._json({"ok": True, "muted": False})

        if action == "send":
            try:
                body = await request.json()
            except Exception:
                return self._error("Invalid JSON", 400)
            number = body.get("number", "").strip()
            text   = body.get("text", "").strip()
            if not number or not text:
                return self._error("number and text required", 400)
            ok = await coord.send_sms(number, text)
            return self._json({"ok": ok})

        if action.startswith("call/"):
            number = action[len("call/"):]
            call_device = coord.entry.data.get("call_device", "").strip()
            if not call_device:
                return self._error("Call device not configured", 503)
            from .dialer import DialError, validate_phone_number
            from .const import (
                CONF_CALL_DIAL_TIMEOUT, CONF_CALL_DURATION,
                DEFAULT_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DURATION,
            )
            try:
                validate_phone_number(number)
            except DialError as e:
                return self._error(str(e), 400)

            dial_timeout = coord.entry.data.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT)
            call_duration = coord.entry.data.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION)

            async def _do_call():
                reason = await coord.dial(
                    call_device, number,
                    dial_timeout_sec=dial_timeout, call_duration_sec=call_duration,
                )
                await self.hass.async_add_executor_job(
                    coord.store.add_call, number, reason.value
                )
                coord.push_event("call_ended", {"number": number, "reason": reason.value})

            self.hass.async_create_task(_do_call())
            return self._json({"ok": True, "calling": True})

        if action == "hangup":
            call_device = coord.entry.data.get("call_device", "").strip()
            if not call_device:
                return self._error("Call device not configured", 503)
            from .dialer import hangup as hangup_call
            ok = await hangup_call(call_device)
            return self._json({"ok": ok})

        if action.startswith("delete_call/"):
            call_id = self._parse_int(action[len("delete_call/"):])
            if call_id is None:
                return self._error("Invalid call id", 400)
            await self.hass.async_add_executor_job(store.delete_call, call_id)
            return self._json({"ok": True})

        if action == "clear_call_history":
            await self.hass.async_add_executor_job(store.clear_call_history)
            return self._json({"ok": True})

        if action == "set_sim_phone_number":
            try:
                body = await request.json()
            except Exception:
                return self._error("Invalid JSON", 400)
            number = (body.get("number") or "").strip()
            await self.hass.async_add_executor_job(
                store.set_setting, "sim_phone_number", number
            )
            return self._json({"ok": True, "number": number})

        if action == "add_contact":
            try:
                body = await request.json()
            except Exception:
                return self._error("Invalid JSON", 400)
            number = (body.get("number") or "").strip()
            name = (body.get("name") or "").strip()
            label = (body.get("label") or "").strip()
            email = (body.get("email") or "").strip()
            company = (body.get("company") or "").strip()
            birthday = (body.get("birthday") or "").strip()
            notes = (body.get("notes") or "").strip()
            # ``None`` означает «оставить существующее фото», пустая строка —
            # удалить его. Фронтенд заранее уменьшает фото до 512 px.
            avatar = body.get("avatar") if "avatar" in body else None
            if not number:
                return self._error("number required", 400)
            if not name:
                return self._error("name required", 400)
            if len(number) > 64 or len(name) > 120:
                return self._error("contact field too long", 400)
            if any(len(value) > limit for value, limit in (
                (label, 80), (email, 254), (company, 120),
                (birthday, 10), (notes, 4000),
            )):
                return self._error("contact field too long", 400)
            if avatar is not None:
                if not isinstance(avatar, str):
                    return self._error("invalid avatar", 400)
                if avatar and not avatar.startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")):
                    return self._error("invalid avatar format", 400)
                if len(avatar) > 700_000:
                    return self._error("avatar too large", 413)
            await self.hass.async_add_executor_job(
                store.add_contact, number, name, label, email, company,
                birthday, notes, avatar,
            )
            contact = await self.hass.async_add_executor_job(store.get_contact, number)
            coord.push_event("contact_saved", {"number": number, "name": name})
            return self._json({"ok": True, "contact": contact})

        if action.startswith("delete_phonebook_contact/"):
            from urllib.parse import unquote as _uq
            number = _uq(action[len("delete_phonebook_contact/"):])
            await self.hass.async_add_executor_job(store.delete_contact, number)
            coord.push_event("contact_deleted_pb", {"number": number})
            return self._json({"ok": True})

        if action == "poll_now":
            if not coord.collecting:
                async def _manual():
                    msgs = await coord._safe_get_all()
                    if msgs:
                        await coord._collect(msgs)
                self.hass.async_create_task(_manual())
            return self._json({"ok": True, "collecting": coord.collecting})

        if action == "reset_modem":
            try:
                result = await coord.client.reset_modem()
                return self._json({"ok": True, "result": result})
            except Exception as e:
                return self._error(str(e), 500)

        return self._error("Unknown action", 404)

    async def _export(self, store: SmsStore, fmt: str) -> web.Response:
        all_msgs = await self.hass.async_add_executor_job(store.get_all)

        if fmt == "json":
            text = json.dumps(all_msgs, ensure_ascii=False, indent=2, default=str)
            return web.Response(
                body=text.encode("utf-8"),
                content_type="application/json",
                headers={"Content-Disposition": "attachment; filename=sms_export.json"},
            )

        if fmt == "csv":
            import csv, io
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(["id", "number", "date", "received", "is_read", "text"])
            for m in all_msgs:
                writer.writerow([m.get("id"), m.get("number"), m.get("date"),
                                  m.get("received"), m.get("is_read"), m.get("text")])
            return web.Response(
                body=buf.getvalue().encode("utf-8-sig"),
                content_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=sms_export.csv"},
            )

        return self._error("Unknown format, use json or csv", 400)

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






























