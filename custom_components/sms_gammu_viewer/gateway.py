"""Клиент для REST API sms-gammu-gateway."""
from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME

_LOGGER = logging.getLogger(__name__)

# Gammu-gateway иногда зависает на команде при занятом модеме.
# 30 секунд — разумный максимум для отправки SMS.
SEND_TIMEOUT = 30
SEND_RETRY_DELAY = 3  # секунд перед повтором


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

    async def _request(self, method: str, path: str, timeout: int = 10, **kwargs) -> Any:
        t = aiohttp.ClientTimeout(total=timeout)
        async with self._session.request(
            method, f"{self._base}{path}",
            headers=self._headers, timeout=t, **kwargs
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

    async def get_signal(self) -> dict | None:
        try:
            return await self._request("GET", "/status/signal")
        except Exception:
            return None

    async def get_network(self) -> dict | None:
        try:
            return await self._request("GET", "/status/network")
        except Exception:
            return None

    async def get_modem(self) -> dict | None:
        try:
            return await self._request("GET", "/status/modem")
        except Exception:
            return None

    async def get_sim(self) -> dict | None:
        try:
            return await self._request("GET", "/status/sim")
        except Exception:
            return None

    async def get_sms_capacity(self) -> dict | None:
        try:
            return await self._request("GET", "/status/sms_capacity")
        except Exception:
            return None

    async def reset_modem(self) -> dict | None:
        return await self._request("GET", "/status/reset", timeout=30)

    async def send_sms(self, number: str, text: str) -> bool:
        """Отправляет SMS. При таймауте делает один повтор через 3 секунды.

        Gateway принимает form-data (не JSON). Параметр unicode=true обязателен
        для кириллицы — без него GSM7 кодировка заменяет нелатинские символы на '?'.
        """
        # Определяем нужен ли Unicode режим (кириллица, emoji, и т.д.)
        needs_unicode = any(ord(c) > 127 for c in text)
        for attempt in range(2):
            # FormData нельзя переиспользовать — создаём заново на каждую попытку
            form_data = aiohttp.FormData()
            form_data.add_field("number", number)
            form_data.add_field("text", text)
            if needs_unicode:
                form_data.add_field("unicode", "true")
            try:
                await self._request(
                    "POST", "/sms",
                    data=form_data,
                    timeout=SEND_TIMEOUT,
                )
                if attempt > 0:
                    _LOGGER.info("send_sms succeeded on retry (attempt %d)", attempt + 1)
                return True

            except aiohttp.ClientResponseError as e:
                _LOGGER.error(
                    "send_sms failed: HTTP %s %s (number=%s, text_len=%d)",
                    e.status, e.message, number, len(text),
                )
                return False  # HTTP ошибка — повтор не поможет

            except aiohttp.ClientConnectorError as e:
                _LOGGER.error("send_sms connection error (gateway unreachable?): %s", e)
                return False  # Нет связи — повтор не поможет

            except (asyncio.TimeoutError, aiohttp.ServerTimeoutError):
                if attempt == 0:
                    _LOGGER.warning(
                        "send_sms timeout after %ds (number=%s), retrying in %ds…",
                        SEND_TIMEOUT, number, SEND_RETRY_DELAY,
                    )
                    await asyncio.sleep(SEND_RETRY_DELAY)
                else:
                    _LOGGER.error(
                        "send_sms timeout after %ds on retry, giving up (number=%s)",
                        SEND_TIMEOUT, number,
                    )
                    return False

            except Exception as e:
                _LOGGER.error("send_sms unexpected error: %s: %s", type(e).__name__, e)
                return False

        return False

    async def test_connection(self) -> str | None:
        try:
            await self._request("GET", "/status/signal", timeout=10)
            return None
        except aiohttp.ClientResponseError as e:
            if e.status == 401:
                return "invalid_auth"
            return "cannot_connect"
        except Exception:
            return "cannot_connect"
