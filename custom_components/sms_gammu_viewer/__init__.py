"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import logging
import base64
import aiohttp
from aiohttp import web

from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import CONF_HOST, CONF_PORT, CONF_USERNAME, CONF_PASSWORD, DOMAIN
from .frontend import async_register_panel, async_unregister_panel

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = dict(entry.data)

    is_first = len(hass.data[DOMAIN]) == 1
    if is_first:
        hass.http.register_view(SmsProxyView(hass))
        await async_register_panel(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop(entry.entry_id, None)
    if not hass.data[DOMAIN]:
        async_unregister_panel(hass)
    return True


def _get_config(hass: HomeAssistant) -> dict:
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        return {}
    return next(iter(entries.values()))


class SmsProxyView(HomeAssistantView):
    """Прокси к REST API sms-gammu-gateway."""

    url = "/api/sms_gammu_viewer/{path:.*}"
    name = "api:sms_gammu_viewer"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "GET")

    async def post(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "POST")

    async def _proxy(self, request: web.Request, path: str, method: str) -> web.Response:
        cfg = _get_config(self.hass)
        if not cfg:
            return web.Response(
                text='{"error": "Not configured"}',
                status=503,
                content_type="application/json",
            )

        url = f"http://{cfg[CONF_HOST]}:{cfg[CONF_PORT]}/{path}"
        creds = base64.b64encode(
            f"{cfg[CONF_USERNAME]}:{cfg[CONF_PASSWORD]}".encode()
        ).decode()
        headers = {
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/json",
        }

        body = None
        if method == "POST":
            try:
                body = await request.read()
            except Exception:
                pass

        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(method, url, headers=headers, data=body) as resp:
                    data = await resp.read()
                    return web.Response(
                        body=data,
                        status=resp.status,
                        content_type=resp.content_type,
                    )
        except aiohttp.ClientConnectorError:
            return web.Response(
                text='{"error": "Cannot connect to SMS gateway"}',
                status=502,
                content_type="application/json",
            )
        except Exception as err:
            _LOGGER.error("Proxy error: %s", err)
            return web.Response(
                text=f'{{"error": "{err}"}}',
                status=500,
                content_type="application/json",
            )
