"""SMS Gammu Viewer — нативная панель для Home Assistant."""
from __future__ import annotations

import logging
import shutil
import os
import aiohttp
from aiohttp import web
from pathlib import Path

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.frontend import async_register_built_in_panel

_LOGGER = logging.getLogger(__name__)

DOMAIN = "sms_gammu_viewer"
PANEL_URL = "sms-viewer"
PANEL_TITLE = "SMS"
PANEL_ICON = "mdi:message-text"

CONF_HOST = "host"
CONF_PORT = "port"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 5000
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "password"


def _copy_panel_js(hass: HomeAssistant) -> None:
    src_dir = Path(__file__).parent / "www"
    dst_dir = Path(hass.config.config_dir) / "www" / "sms_gammu_viewer"
    dst_dir.mkdir(parents=True, exist_ok=True)

    src = src_dir / "panel.js"
    dst = dst_dir / "panel.js"

    if src.exists():
        shutil.copy2(src, dst)
        _LOGGER.info("SMS Gammu Viewer: panel.js скопирован в %s", dst)
    else:
        _LOGGER.error("SMS Gammu Viewer: panel.js не найден в %s", src)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    cfg = config.get(DOMAIN, {})
    host = cfg.get(CONF_HOST, DEFAULT_HOST)
    port = cfg.get(CONF_PORT, DEFAULT_PORT)
    username = cfg.get(CONF_USERNAME, DEFAULT_USERNAME)
    password = cfg.get(CONF_PASSWORD, DEFAULT_PASSWORD)

    hass.data[DOMAIN] = {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
    }

    await hass.async_add_executor_job(_copy_panel_js, hass)

    hass.http.register_view(SmsProxyView(hass))

    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL,
        config={
            "_panel_custom": {
                "name": "sms-gammu-panel",
                "module_url": "/local/sms_gammu_viewer/panel.js",
            }
        },
        require_admin=False,
    )

    _LOGGER.info("SMS Gammu Viewer panel registered")
    return True


class SmsProxyView(HomeAssistantView):
    """Прокси-вид для запросов к REST API аддона."""

    url = "/api/sms_gammu_viewer/{path:.*}"
    name = "api:sms_gammu_viewer"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "GET")

    async def post(self, request: web.Request, path: str) -> web.Response:
        return await self._proxy(request, path, "POST")

    async def _proxy(
        self, request: web.Request, path: str, method: str
    ) -> web.Response:
        cfg = self.hass.data[DOMAIN]
        base_url = f"http://{cfg['host']}:{cfg['port']}"
        url = f"{base_url}/{path}"

        import base64
        creds = base64.b64encode(
            f"{cfg['username']}:{cfg['password']}".encode()
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
                body = None

        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(
                    method, url, headers=headers, data=body
                ) as resp:
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
