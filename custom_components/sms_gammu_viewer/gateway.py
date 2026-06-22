"""Клиент для REST API sms-gammu-gateway."""
from __future__ import annotations

import base64
import logging
from typing import Any

import aiohttp

from .const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME

_LOGGER = logging.getLogger(__name__)


class GatewayClient:
    def __init__(self, cfg: dict) -> None:
        self._base = f"http://{cfg[CONF_HOST]}:{cfg[CONF_PORT]}"
        creds = base64.b64encode(
            f"{cfg[CONF_USERNAME]}:{cfg[CONF_PASSWORD]}".encode()
        ).decode()
        self._headers = {
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, timeout: int = 10, **kwargs) -> Any:
        t = aiohttp.ClientTimeout(total=timeout)
        async with aiohttp.ClientSession(timeout=t) as s:
            async with s.request(
                method, f"{self._base}{path}", headers=self._headers, **kwargs
            ) as r:
                r.raise_for_status()
                if r.content_length == 0 or r.status == 204:
                    return None
                return await r.json()

    async def get_all_sms(self) -> list[dict]:
        """GET /sms — возвращает все SMS целиком (multipart уже склеены)."""
        try:
            data = await self._request("GET", "/sms")
            if isinstance(data, list):
                return data
            return []
        except aiohttp.ClientResponseError as e:
            _LOGGER.debug("get_all_sms HTTP %s: %s", e.status, e.message)
            return []
        except aiohttp.ClientConnectorError as e:
            _LOGGER.debug("get_all_sms connection error: %s", e)
            return []
        except Exception as e:
            _LOGGER.debug("get_all_sms error: %s: %s", type(e).__name__, e)
            return []

    async def delete_sms(self, sms_id: int) -> bool:
        """DELETE /sms/{id} — удаляет конкретное SMS с симки."""
        try:
            await self._request("DELETE", f"/sms/{sms_id}")
            return True
        except Exception as e:
            _LOGGER.warning("delete_sms(%s) error: %s", sms_id, e)
            return False

    async def delete_all_sms(self) -> bool:
        """DELETE /sms/deleteall — удаляет все SMS с симки."""
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
        try:
            return await self._request("GET", "/status/reset", timeout=30)
        except Exception as e:
            raise

    async def send_sms(self, number: str, text: str) -> bool:
        """Отправляет SMS. При ошибке логирует HTTP статус и тело ответа."""
        try:
            await self._request("POST", "/sms", json={"number": number, "text": text}, timeout=15)
            return True
        except aiohttp.ClientResponseError as e:
            # Читаем тело ответа для диагностики (e.message содержит reason phrase,
            # но не тело — поэтому логируем статус + message отдельно)
            _LOGGER.error(
                "send_sms failed: HTTP %s %s (number=%s, text_len=%d)",
                e.status, e.message, number, len(text),
            )
            return False
        except aiohttp.ClientConnectorError as e:
            _LOGGER.error("send_sms connection error (gateway unreachable?): %s", e)
            return False
        except aiohttp.ServerTimeoutError:
            _LOGGER.error("send_sms timeout after 15s (number=%s)", number)
            return False
        except Exception as e:
            _LOGGER.error("send_sms unexpected error: %s: %s", type(e).__name__, e)
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
