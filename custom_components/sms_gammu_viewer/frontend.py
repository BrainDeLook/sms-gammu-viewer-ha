"""Frontend panel registration for SMS Gammu Viewer."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN, FRONTEND_PATH, PANEL_ICON, PANEL_TITLE, PANEL_URL


def _locate_frontend_dir() -> Path:
    return Path(__file__).parent / "ha_frontend"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the SMS Gammu Viewer panel."""
    frontend_dir = _locate_frontend_dir()

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


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the panel."""
    try:
        async_remove_panel(hass, PANEL_URL)
    except KeyError:
        pass
