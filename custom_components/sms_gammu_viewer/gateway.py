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

    async def _get(self, path: str, timeout: int = 10) -> Any:
        t = aiohttp.ClientTimeout(total=timeout)
        async with aiohttp.ClientSession(timeout=t) as s:
            async with s.get(f"{self._base}{path}", headers=self._headers) as r:
                r.raise_for_status()
                return await r.json()

    async def pop_sms(self) -> dict | None:
        """GET /sms/getsms — забирает первое SMS и удаляет его с симки."""
        try:
            data = await self._get("/sms/getsms")
            if isinstance(data, dict) and data.get("Text"):
                return data
            return None
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                return None
            _LOGGER.debug("pop_sms HTTP %s", e.status)
            return None
        except Exception as e:
            _LOGGER.debug("pop_sms error: %s", e)
            return None

    async def get_signal(self) -> dict | None:
        try:
            return await self._get("/status/signal")
        except Exception:
            return None

    async def get_network(self) -> dict | None:
        try:
            return await self._get("/status/network")
        except Exception:
            return None

    async def get_modem(self) -> dict | None:
        try:
            return await self._get("/status/modem")
        except Exception:
            return None

    async def send_sms(self, number: str, text: str) -> bool:
        t = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=t) as s:
            async with s.post(
                f"{self._base}/sms",
                headers=self._headers,
                json={"number": number, "text": text},
            ) as r:
                return r.status == 200

    async def test_connection(self) -> str | None:
        """Возвращает None если OK, иначе строку с ошибкой."""
        try:
            await self._get("/status/signal", timeout=10)
            return None
        except aiohttp.ClientResponseError as e:
            if e.status == 401:
                return "invalid_auth"
            return "cannot_connect"
        except Exception:
            return "cannot_connect"
