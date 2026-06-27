"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import aiohttp
from aiohttp import web

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
    CONF_COLLECT_EMPTY_MAX,
    CONF_SHOW_PANEL,
    DEFAULT_SHOW_PANEL,
    CONF_COLLECT_INTERVAL,
    CONF_NOTIFY_TARGETS,
    CONF_POLL_INTERVAL,
    DB_FILENAME,
    DEFAULT_COLLECT_EMPTY_MAX,
    DEFAULT_COLLECT_INTERVAL,
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

MODEM_ERROR_RESET_THRESHOLD = 5  # После N ошибок подряд — сброс модема
MODEM_RESET_COOLDOWN = 120       # Пауза после сброса (секунды)


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
        show_panel = entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)
        if show_panel:
            await _register_panel(hass)
        await _register_services(hass)

    hass.http.register_view(SmsApiView(hass))
    await coordinator.start()
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor", "cover", "button"])
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    # Прогреваем кеш статуса при старте
    try:
        _s, _n, _m, _si, _cap = await asyncio.gather(
            coordinator.client.get_signal(),
            coordinator.client.get_network(),
            coordinator.client.get_modem(),
            coordinator.client.get_sim(),
            coordinator.client.get_sms_capacity(),
            return_exceptions=True,
        )
        coordinator._status_cache = {
            "signal":   None if isinstance(_s,   Exception) else _s,
            "network":  None if isinstance(_n,   Exception) else _n,
            "modem":    None if isinstance(_m,   Exception) else _m,
            "sim":      None if isinstance(_si,  Exception) else _si,
            "capacity": None if isinstance(_cap, Exception) else _cap,
            "call_enabled": bool(coordinator.entry.data.get("call_device", "").strip()),
            "language":   coordinator.entry.data.get("language", "ru"),
            "show_panel": coordinator.entry.data.get("show_panel", True),
        }
        _LOGGER.debug("Status cache warmed up")
    except Exception as e:
        _LOGGER.debug("Status cache warmup failed: %s", e)

    _LOGGER.info("SMS Gammu Viewer started: %s", entry.title)
    return True


async def _register_services(hass: HomeAssistant) -> None:
    """Регистрирует sms_gammu_viewer.send_sms и sms_gammu_viewer.call."""
    import voluptuous as vol
    from homeassistant.helpers import config_validation as cv
    from .dialer import dial_number, hangup as hangup_call, CallEndedReason, DialError, validate_phone_number
    from .const import (
        CONF_CALL_DEVICE, CONF_CALL_DIAL_TIMEOUT, CONF_CALL_DURATION,
        DEFAULT_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DURATION, EVENT_CALL_ENDED,
    )

    def _get_coord():
        entries = hass.data.get(DOMAIN, {})
        if not entries:
            raise ValueError("Интеграция SMS Gammu Viewer не настроена")
        return next(iter(entries.values()))

    async def _handle_send_sms(call) -> None:
        number = call.data.get("number", "").strip()
        message = call.data.get("message", "").strip()
        if not number:
            raise ValueError("Поле number обязательно")
        if not message:
            raise ValueError("Поле message обязательно")

        coord = _get_coord()
        coord.send_in_progress = True
        try:
            ok = await coord.client.send_sms(number, message)
        finally:
            coord.send_in_progress = False
        if not ok:
            raise ValueError(f"Не удалось отправить SMS на {number}")
        # Сохраняем исходящее в историю чата
        msg_id = await hass.async_add_executor_job(coord.store.add_outgoing, number, message)
        if msg_id:
            coord.push_event("new_message", {
                "id": msg_id, "number": number, "text": message,
                "date": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                "is_read": 1, "direction": "out",
            })
        # Событие в шину HA для автоматизаций
        hass.bus.async_fire(f"{DOMAIN}_sms_sent", {"number": number, "message": message})
        _LOGGER.info("SMS sent to %s via send_sms service", number)

    async def _handle_call(call) -> None:
        number = call.data.get("number", "").strip()
        if not number:
            raise ValueError("Поле number обязательно")

        coord = _get_coord()
        call_device = coord.entry.data.get(CONF_CALL_DEVICE, "").strip()
        if not call_device:
            raise ValueError("Голосовой порт не настроен в интеграции")

        try:
            validate_phone_number(number)
        except DialError as e:
            raise ValueError(str(e)) from e

        dial_timeout = coord.entry.data.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT)
        call_duration = coord.entry.data.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION)

        _LOGGER.info("Calling +%s via call service...", number)
        coord.call_in_progress = True
        try:
            reason = await dial_number(
                call_device, number,
                dial_timeout_sec=dial_timeout, call_duration_sec=call_duration,
            )
        finally:
            coord.call_in_progress = False
        hass.bus.async_fire(EVENT_CALL_ENDED, {"phone_number": number, "reason": reason.value})
        await hass.async_add_executor_job(coord.store.add_call, number, reason.value)
        coord.push_event("call_ended", {"number": number, "reason": reason.value})
        _LOGGER.info("Call to +%s ended: %s", number, reason.value)

    async def _handle_hangup(call) -> None:
        coord = _get_coord()
        call_device = coord.entry.data.get(CONF_CALL_DEVICE, "").strip()
        if not call_device:
            raise ValueError("Голосовой порт не настроен в интеграции")
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
            remove_extra_js_url(hass, f"/{PANEL_URL}/{FRONTEND_PATH}/sms-gammu-viewer-card.js")
        except (KeyError, ValueError):
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

    # Регистрируем Lovelace-карточку для всех пользователей автоматически —
    # тот же приём что у frenck/home-assistant-doom: статика уже раздаётся
    # из той же папки frontend/, просто подключаем JS глобально, без
    # необходимости вручную прописывать ресурс в Settings → Dashboards.
    add_extra_js_url(hass, f"/{PANEL_URL}/{FRONTEND_PATH}/sms-gammu-viewer-card.js")


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


class NumberBuffer:
    """Буфер для сборки SMS от одного номера за один цикл collect.

    Gateway возвращает SMS по-разному в зависимости от ситуации:
    - Одна запись которая растёт (multipart собирается постепенно по эфиру)
    - Несколько записей — каждая часть своя запись, они могут иметь
      одинаковую или разную дату

    Стратегия: для каждой уникальной (date, text_prefix) пары храним
    лучший текст. Если пришёл текст длиннее для той же записи — обновляем.
    Если пришёл совсем другой текст с той же датой — это новая часть,
    добавляем отдельно. В конце конкатенируем все части по порядку получения.
    """

    def __init__(self, number: str) -> None:
        self.number = number
        self.first_date: str = ""
        self.seen_count: int = 0
        # Список (date, text) в порядке получения — каждый элемент это часть SMS
        self._parts: list[tuple[str, str]] = []

    def add(self, text: str, date: str) -> bool:
        self.seen_count += 1
        if not self.first_date:
            self.first_date = date

        # Ищем существующую часть которую этот текст может обновить:
        # текст является продолжением (начинается с сохранённого) или наоборот
        for i, (d, existing) in enumerate(self._parts):
            if d != date:
                continue
            if text.startswith(existing) or existing.startswith(text):
                # Это та же запись — обновляем до более длинной версии
                if len(text) > len(existing):
                    self._parts[i] = (date, text)
                    return True
                return False  # Не новее

        # Это новая часть — добавляем
        self._parts.append((date, text))
        return True

    @property
    def full_text(self) -> str:
        result = "".join(text for _, text in self._parts)
        if _looks_like_wap_push(result):
            return "📎 Входящий MMS (не поддерживается)"
        return result


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
        self.client = GatewayClient(self.entry.data)
        await self.start()

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
                messages = await self._safe_get_all()
                if messages:
                    self._error_streak = 0
                    await self._collect(messages)
                else:
                    if messages is not None:
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

    async def _collect(self, first_batch: list[dict]) -> None:
        """
        Сборка multipart SMS таймером ожидания: после получения первой части
        опрашиваем модем каждые COLLECT_INTERVAL секунд, пока не наберём
        COLLECT_EMPTY_MAX пустых ответов подряд — тогда считаем что все части
        собраны.

        Примечание: проверялась возможность использовать поле Complete из API
        sms-gammu-gateway (введено в одном из коммитов автора аддона), но на
        практике в установленных версиях аддона это поле в ответе /sms не
        встречается — реальный JSON содержит только Date/Number/State/Text.
        Поэтому таймер остаётся единственным рабочим механизмом сборки.
        """
        self.collecting = True
        _LOGGER.info("Collect mode: %d messages on SIM", len(first_batch))

        buffers: dict[tuple, NumberBuffer] = {}
        self._add_to_buffers(buffers, first_batch)
        await self._safe_delete_all()

        collect_interval = self._collect_interval
        collect_empty_max = self._collect_empty_max

        empty_streak = 0
        while empty_streak < collect_empty_max:
            await asyncio.sleep(collect_interval)

            # Если начался звонок — приостанавливаем сборку до его завершения
            if self.call_in_progress:
                _LOGGER.debug("Collect: pausing — call in progress")
                while self.call_in_progress:
                    await asyncio.sleep(1)
                # Сбрасываем счётчик — за время звонка могли прийти новые части
                empty_streak = 0
                _LOGGER.debug("Collect: resuming after call, resetting empty counter")
                continue

            messages = await self._safe_get_all()

            if not messages:
                empty_streak += 1
                _LOGGER.debug("Collect: empty %d/%d", empty_streak, collect_empty_max)
                continue

            got_new = self._add_to_buffers(buffers, messages)
            await self._safe_delete_all()
            # Сбрасываем счётчик при ЛЮБОМ непустом ответе — раз на симке
            # что-то есть, сборка ещё идёт (gammu может отдавать ту же запись
            # пока части ещё не все собраны)
            empty_streak = 0
            if got_new:
                _LOGGER.debug(
                    "Collect: new part(s) received (%d msg on SIM), resetting empty counter",
                    len(messages)
                )
            else:
                _LOGGER.debug(
                    "Collect: %d msg on SIM, no new content yet, waiting…",
                    len(messages)
                )

        for number, buf in buffers.items():
            full_text = buf.full_text
            _LOGGER.info("SMS assembled from %s: %d updates seen, %d chars", number, buf.seen_count, len(full_text))
            await self._save_one(number, full_text, buf.first_date)

        self.collecting = False

    async def _save_one(self, number: str, text: str, date: str) -> None:
        """Сохраняет SMS в БД.

        Если звонок прервал сборку — части SMS могут прийти в нескольких
        отдельных collect-циклах. В этом случае ищем недавнее сообщение
        от того же номера и дописываем к нему — но только если текст
        реально новый (не пересекается с уже сохранённым).
        """
        recent = await self.hass.async_add_executor_job(
            self.store.find_recent, number, 120
        )
        if recent:
            saved = recent["text"]
            # Дописываем только если текст реально новый:
            # - не является подстрокой уже сохранённого
            # - уже сохранённый не является подстрокой нового
            if text not in saved and saved not in text:
                _LOGGER.info(
                    "Appending continuation to SMS id=%s from %s (+%d chars)",
                    recent["id"], number, len(text)
                )
                await self.hass.async_add_executor_job(
                    self.store.append_text, recent["id"], text
                )
                full_text = saved + text
                self.push_event("new_message", {
                    "id": recent["id"], "number": number,
                    "text": full_text, "date": date, "is_read": 0
                })
                await self._notify(number, full_text)
                return

        # Новое сообщение
        msg_id = await self.hass.async_add_executor_job(
            self.store.add, number, text, date
        )
        if msg_id:
            self.push_event("new_message", {
                "id": msg_id, "number": number,
                "text": text, "date": date, "is_read": 0
            })
        await self._notify(number, text)


    def _add_to_buffers(self, buffers: dict[str, NumberBuffer], messages: list[dict]) -> bool:
        got_new = False
        for msg in messages:
            number = msg.get("Number", "Unknown")
            text   = msg.get("Text", "")
            date   = msg.get("Date", "")
            if not text:
                continue
            # Группируем только по номеру — части одного SMS могут иметь разные даты
            if number not in buffers:
                buffers[number] = NumberBuffer(number)
            if buffers[number].add(text, date):
                got_new = True
        return got_new

    async def _safe_get_all(self) -> list[dict] | None:
        import time
        try:
            result = await self.client.get_all_sms()
            if not self._modem_ok:
                self._modem_ok = True
                self.push_event("modem_status", {"ok": True})
                _LOGGER.info("Modem connection restored")
            self._error_streak = 0
            return result
        except Exception as e:
            self._error_streak += 1
            self._modem_ok = False
            _LOGGER.warning("get_all_sms failed (%d/%d): %s",
                            self._error_streak, MODEM_ERROR_RESET_THRESHOLD, e)
            self.push_event("modem_status", {
                "ok": False,
                "error": str(e),
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
                    # Пауза чтобы модем успел перезагрузиться
                    await asyncio.sleep(15)
                except Exception as re:
                    _LOGGER.error("Modem reset failed: %s", re)
            return None

    async def _safe_delete_all(self) -> None:
        try:
            await self.client.delete_all_sms()
        except Exception as e:
            _LOGGER.warning("delete_all_sms failed: %s", e)

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
                            "actions": [
                                {
                                    "action": "URI",
                                    "title": "Открыть SMS",
                                    "uri": "/sms-viewer",
                                }
                            ],
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
            cache = coord._status_cache
            if cache is not None:
                async def _bg(c=coord):
                    try:
                        _s, _n, _m, _si, _cap = await asyncio.gather(
                            c.client.get_signal(), c.client.get_network(),
                            c.client.get_modem(), c.client.get_sim(),
                            c.client.get_sms_capacity(), return_exceptions=True,
                        )
                        c._status_cache = {
                            "signal":   None if isinstance(_s,   Exception) else _s,
                            "network":  None if isinstance(_n,   Exception) else _n,
                            "modem":    None if isinstance(_m,   Exception) else _m,
                            "sim":      None if isinstance(_si,  Exception) else _si,
                            "capacity": None if isinstance(_cap, Exception) else _cap,
                            "call_enabled": bool(c.entry.data.get("call_device", "").strip()),
                            "language":   c.entry.data.get("language", "ru"),
                            "show_panel": c.entry.data.get("show_panel", True),
                        }
                    except Exception:
                        pass
                self.hass.async_create_task(_bg())
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
            number = action[len("phonebook/"):]
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
            last_id = int(request.rel_url.query.get("since", "0"))
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
            msg_id = int(action[len("read/"):])
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
            msg_id = int(action[len("star/"):])
            await self.hass.async_add_executor_job(store.star_message, msg_id)
            return self._json({"ok": True})

        if action.startswith("unstar/"):
            msg_id = int(action[len("unstar/"):])
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
            msg_id = int(action[len("delete/"):])
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
            coord.send_in_progress = True
            try:
                ok = await coord.client.send_sms(number, text)
            finally:
                coord.send_in_progress = False
            if ok:
                # Сохраняем исходящее в историю чата
                import datetime as _dt
                msg_id = await self.hass.async_add_executor_job(store.add_outgoing, number, text)
                if msg_id:
                    coord.push_event("new_message", {
                        "id": msg_id, "number": number, "text": text,
                        "date": _dt.datetime.now().isoformat(timespec="seconds"),
                        "is_read": 1, "direction": "out",
                    })
                self.hass.bus.async_fire(f"{DOMAIN}_sms_sent", {"number": number, "message": text})
            return self._json({"ok": ok})

        if action.startswith("call/"):
            number = action[len("call/"):]
            call_device = coord.entry.data.get("call_device", "").strip()
            if not call_device:
                return self._error("Call device not configured", 503)
            from .dialer import dial_number, DialError, validate_phone_number
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
                coord.call_in_progress = True
                try:
                    reason = await dial_number(
                        call_device, number,
                        dial_timeout_sec=dial_timeout, call_duration_sec=call_duration,
                    )
                finally:
                    coord.call_in_progress = False
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
            call_id = int(action[len("delete_call/"):])
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
            if not number:
                return self._error("number required", 400)
            if not name:
                return self._error("name required", 400)
            await self.hass.async_add_executor_job(store.add_contact, number, name, label)
            coord.push_event("contact_saved", {"number": number, "name": name, "label": label})
            return self._json({"ok": True})

        if action.startswith("delete_phonebook_contact/"):
            number = action[len("delete_phonebook_contact/"):]
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






























