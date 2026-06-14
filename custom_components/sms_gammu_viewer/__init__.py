"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import base64
import logging

import aiohttp
from aiohttp import web
from pathlib import Path

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
    CONF_PASSWORD,
    CONF_PORT,
    CONF_USERNAME,
    DOMAIN,
    FRONTEND_PATH,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
)

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = dict(entry.data)

    is_first = len(hass.data[DOMAIN]) == 1

    hass.http.register_view(SmsProxyView(hass))

    if is_first:
        await _register_panel(hass)

    _LOGGER.info("SMS Gammu Viewer setup complete: %s", entry.title)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop(entry.entry_id, None)
    if not hass.data[DOMAIN]:
        try:
            async_remove_panel(hass, PANEL_URL)
        except KeyError:
            pass
    return True


async def _register_panel(hass: HomeAssistant) -> None:
    frontend_dir = Path(__file__).parent / FRONTEND_PATH

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                f"/{PANEL_URL}/{FRONTEND_PATH}",
                str(frontend_dir),
                cache_headers=False,
            )
        ]
    )

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


class SmsProxyView(HomeAssistantView):
    url = "/api/sms_gammu_viewer/{path:.*}"
    name = "api:sms_gammu_viewer"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    def _get_cfg(self) -> dict | None:
        entries = self.hass.data.get(DOMAIN, {})
        if not entries:
            return None
        return next(iter(entries.values()))

    async def get(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "GET")

    async def post(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "POST")

    async def _proxy(self, request: web.Request, path: str, method: str) -> web.Response:
        cfg = self._get_cfg()
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
