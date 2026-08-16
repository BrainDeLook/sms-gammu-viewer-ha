"""Клиент для REST API sms-gammu-gateway."""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME

_LOGGER = logging.getLogger(__name__)

# Gammu-gateway иногда зависает на команде при занятом модеме.
# 30 секунд — разумный максимум для отправки SMS.
SEND_TIMEOUT = 30


class GatewayClient:
    def __init__(self, hass: HomeAssistant, cfg: dict) -> None:
        self._session = async_get_clientsession(hass)
        self._base = f"http://{cfg[CONF_HOST]}:{cfg[CONF_PORT]}"
        creds = base64.b64encode(
            f"{cfg[CONF_USERNAME]}:{cfg[CONF_PASSWORD]}".encode()
        ).decode()
        self._headers = {
            "Authorization": f"Basic {creds}",
        }
        # В gateway один Gammu StateMachine и один serial control port.
        # Не создаём параллельную очередь HTTP-запросов к нему: это смешивает
        # AT-ответы/URC и провоцирует ложные таймауты отправки.
        self._operation_lock = asyncio.Lock()
        self._raw_sms_api_supported: bool | None = None
        self._lean_api_supported: bool | None = None
        self._lean_status_cache: dict | None = None
        self._lean_status_at = 0.0
        self._lean_status_lock = asyncio.Lock()

    async def _request(
        self,
        method: str,
        path: str,
        timeout: int = 10,
        *,
        fresh_connection: bool = False,
        **kwargs,
    ) -> Any:
        t = aiohttp.ClientTimeout(total=timeout)
        headers = dict(self._headers)
        if fresh_connection:
            # The add-on currently uses Flask's development HTTP server. It
            # closes some otherwise reusable connections after a response;
            # explicitly opting out of pooling avoids making the following
            # ACK request on a stale socket.
            headers["Connection"] = "close"
        async with self._operation_lock:
            async with self._session.request(
                method, f"{self._base}{path}",
                headers=headers, timeout=t, **kwargs
            ) as r:
                r.raise_for_status()
                if r.content_length == 0 or r.status == 204:
                    return None
                return await r.json()

    async def get_all_sms(self) -> list[dict]:
        """GET /sms — возвращает все SMS целиком.

        Ошибки соединения/HTTP пробрасываются наверх: на них опирается
        подсчёт error_streak и авто-сброс модема в координаторе.
        Пустой список означает именно «на SIM нет сообщений».
        """
        data = await self._request("GET", "/sms")
        if isinstance(data, list):
            return data
        return []

    async def get_queued_messages(self) -> list[dict] | None:
        """Return durable logical messages from the lean gateway.

        ``None`` means this is an older gateway and the caller may probe the
        raw/legacy APIs. Other errors must not trigger an unsafe fallback.
        """
        if self._lean_api_supported is False:
            return None
        try:
            data = await self._request("GET", "/v1/messages", timeout=15)
        except aiohttp.ClientResponseError as error:
            if error.status == 404:
                self._lean_api_supported = False
                _LOGGER.info("Gateway has no durable v1 message API")
                return None
            raise
        self._lean_api_supported = True
        return data if isinstance(data, list) else []

    async def acknowledge_queued_message(self, message_id: str) -> bool:
        data = await self._request(
            "POST", f"/v1/messages/{message_id}/ack", timeout=15
        )
        return bool(isinstance(data, dict) and data.get("acknowledged"))

    async def _get_lean_status(self) -> dict | None:
        if self._lean_api_supported is not True:
            return None
        async with self._lean_status_lock:
            now = time.monotonic()
            if self._lean_status_cache is not None and now - self._lean_status_at < 3:
                return self._lean_status_cache
            data = await self._request("GET", "/v1/status", timeout=45)
            if isinstance(data, dict):
                self._lean_status_cache = data
                self._lean_status_at = now
                return data
            return None

    async def get_raw_sms_parts(self) -> list[dict] | None:
        """Return physical SMS records when the experimental API is present.

        ``None`` means this gateway does not implement `/sms/raw`; after the
        first 404 the legacy endpoint is used without probing every cycle.
        Other failures are raised so normal modem recovery still applies.
        """
        if self._raw_sms_api_supported is False:
            return None
        try:
            # Gateway serial operations allow up to 60 seconds. The HTTP
            # client must outlive that window or it disconnects while Gammu is
            # still reading the modem.
            data = await self._request(
                "GET", "/sms/raw", timeout=75, fresh_connection=True
            )
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                self._raw_sms_api_supported = False
                _LOGGER.info("Gateway has no experimental raw SMS API")
                return None
            raise
        self._raw_sms_api_supported = True
        return data if isinstance(data, list) else []

    async def acknowledge_raw_sms(
        self, locations: tuple[int, ...], fingerprints: tuple[str, ...]
    ) -> bool:
        """Delete persisted parts only if their location fingerprints match."""
        if len(locations) != len(fingerprints) or not locations:
            return False
        items = [
            {"Location": location, "Fingerprint": fingerprint}
            for location, fingerprint in zip(locations, fingerprints)
        ]
        try:
            data = await self._request(
                "POST", "/sms/raw/ack", timeout=75,
                fresh_connection=True, json={"Parts": items}
            )
        except aiohttp.ServerDisconnectedError:
            # ACK is safe to retry: the gateway compares a fingerprint for
            # every physical location before deleting it.
            _LOGGER.info("Raw SMS ACK connection closed; retrying once")
            data = await self._request(
                "POST", "/sms/raw/ack", timeout=75,
                fresh_connection=True, json={"Parts": items}
            )
        deleted = data.get("Deleted", []) if isinstance(data, dict) else []
        mismatched = data.get("Mismatched", []) if isinstance(data, dict) else []
        if mismatched:
            _LOGGER.warning("Raw SMS acknowledge mismatch: %s", mismatched)
        return len(deleted) == len(items) and not mismatched

    async def delete_sms(self, sms_id: int) -> bool:
        try:
            await self._request("DELETE", f"/sms/{sms_id}")
            return True
        except Exception as e:
            _LOGGER.warning("delete_sms(%s) error: %s", sms_id, e)
            return False

    async def delete_all_sms(self) -> bool:
        try:
            await self._request("DELETE", "/sms/deleteall")
            return True
        except Exception as e:
            _LOGGER.warning("delete_all_sms error: %s", e)
            return False

    async def pop_first_sms(self) -> dict | None:
        """Atomically retrieve and delete the first logical SMS in gateway.

        Unlike ``GET /sms`` followed by ``DELETE /sms/<index>``, this endpoint
        keeps the physical Gammu ``Locations`` inside one gateway request and
        therefore cannot delete a different list item merely because indices
        shifted between two HTTP requests.
        """
        data = await self._request("GET", "/sms/getsms", timeout=30)
        if not isinstance(data, dict) or not data.get("Text"):
            return None
        return data

    async def get_signal(self) -> dict | None:
        try:
            lean = await self._get_lean_status()
            if lean is not None:
                return lean.get("signal")
            return await self._request("GET", "/status/signal")
        except Exception:
            return None

    async def get_network(self) -> dict | None:
        try:
            lean = await self._get_lean_status()
            if lean is not None:
                return lean.get("network")
            return await self._request("GET", "/status/network")
        except Exception:
            return None

    async def get_modem(self) -> dict | None:
        try:
            if self._lean_api_supported is True:
                data = await self._request("GET", "/v1/modem", timeout=45)
                return data if isinstance(data, dict) else None
            return await self._request("GET", "/status/modem")
        except Exception:
            return None

    async def get_sim(self) -> dict | None:
        try:
            if self._lean_api_supported is True:
                modem = await self.get_modem()
                return {"IMSI": modem.get("imsi")} if modem else None
            return await self._request("GET", "/status/sim")
        except Exception:
            return None

    async def get_sms_capacity(self) -> dict | None:
        try:
            lean = await self._get_lean_status()
            if lean is not None:
                return lean.get("capacity")
            return await self._request("GET", "/status/sms_capacity")
        except Exception:
            return None

    async def reset_modem(self) -> dict | None:
        if self._lean_api_supported is True:
            return None
        return await self._request("GET", "/status/reset", timeout=30)

    async def send_sms(self, number: str, text: str) -> bool:
        """Отправляет SMS ровно один раз.

        Gateway принимает form-data (не JSON). Параметр unicode=true обязателен
        для кириллицы — без него GSM7 кодировка заменяет нелатинские символы на '?'.

        Таймаут после ``SendSMS`` означает неизвестный результат: модем мог уже
        принять команду, а HTTP-ответ потерялся. Слепой повтор в таком случае
        создаёт дубликаты, поэтому автоматического retry намеренно нет.
        """
        if self._lean_api_supported is None:
            await self.get_queued_messages()
        # Определяем нужен ли Unicode режим (кириллица, emoji, и т.д.)
        needs_unicode = any(ord(c) > 127 for c in text)
        form_data = aiohttp.FormData()
        form_data.add_field("number", number)
        form_data.add_field("text", text)
        if needs_unicode:
            form_data.add_field("unicode", "true")
        try:
            if self._lean_api_supported is True:
                await self._request(
                    "POST", "/v1/sms", timeout=SEND_TIMEOUT,
                    json={
                        "number": number,
                        "text": text,
                        "unicode": needs_unicode,
                    },
                )
            else:
                await self._request(
                    "POST", "/sms",
                    data=form_data,
                    timeout=SEND_TIMEOUT,
                )
            return True
        except aiohttp.ClientResponseError as e:
            _LOGGER.error(
                "send_sms failed: HTTP %s %s (number=%s, text_len=%d)",
                e.status, e.message, number, len(text),
            )
        except aiohttp.ClientConnectorError as e:
            _LOGGER.error("send_sms connection error (gateway unreachable?): %s", e)
        except (asyncio.TimeoutError, aiohttp.ServerTimeoutError):
            _LOGGER.error(
                "send_sms timed out after %ds (number=%s); outcome is unknown, "
                "not retrying to avoid a duplicate",
                SEND_TIMEOUT, number,
            )
        except Exception as e:
            _LOGGER.error("send_sms unexpected error: %s: %s", type(e).__name__, e)
        return False

    async def test_connection(self) -> str | None:
        try:
            lean = await self.get_queued_messages()
            if lean is not None:
                return None
            await self._request("GET", "/status/signal", timeout=10)
            return None
        except aiohttp.ClientResponseError as e:
            if e.status == 401:
                return "invalid_auth"
            return "cannot_connect"
        except Exception:
            return "cannot_connect"
