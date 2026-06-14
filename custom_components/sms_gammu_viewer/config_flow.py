"""Config flow и Options flow для SMS Gammu Viewer."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_HOST,
    CONF_NOTIFY_TARGETS,
    CONF_PASSWORD,
    CONF_POLL_INTERVAL,
    CONF_PORT,
    CONF_USERNAME,
    DEFAULT_PASSWORD,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_PORT,
    DEFAULT_USERNAME,
    DOMAIN,
)
from .gateway import GatewayClient


class SmsGammuConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            client = GatewayClient(user_input)
            error = await client.test_connection()
            if error:
                errors["base"] = error
            else:
                await self.async_set_unique_id(
                    f"{user_input[CONF_HOST]}:{user_input[CONF_PORT]}"
                )
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=f"SMS Gateway ({user_input[CONF_HOST]})",
                    data={
                        **user_input,
                        CONF_POLL_INTERVAL: DEFAULT_POLL_INTERVAL,
                        CONF_NOTIFY_TARGETS: [],
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST, default="localhost"): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): int,
                vol.Required(CONF_USERNAME, default=DEFAULT_USERNAME): str,
                vol.Required(CONF_PASSWORD, default=DEFAULT_PASSWORD): str,
            }),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return SmsGammuOptionsFlow(config_entry)


class SmsGammuOptionsFlow(OptionsFlow):
    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry

    async def async_step_init(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            targets_raw = user_input.get(CONF_NOTIFY_TARGETS, "")
            targets = [
                t.strip()
                for t in targets_raw.replace(",", "\n").splitlines()
                if t.strip()
            ]
            self.hass.config_entries.async_update_entry(
                self._entry,
                data={
                    **self._entry.data,
                    CONF_POLL_INTERVAL: user_input[CONF_POLL_INTERVAL],
                    CONF_NOTIFY_TARGETS: targets,
                },
            )
            return self.async_create_entry(title="", data={})

        current_targets = self._entry.data.get(CONF_NOTIFY_TARGETS, [])
        targets_str = "\n".join(current_targets)

        notify_services = self._get_notify_services()
        hint = "Например:\n" + "\n".join(notify_services[:5]) if notify_services else ""

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_POLL_INTERVAL,
                    default=self._entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL),
                ): vol.All(int, vol.Range(min=5, max=3600)),
                vol.Optional(CONF_NOTIFY_TARGETS, default=targets_str): str,
            }),
            description_placeholders={
                "notify_hint": hint or "notify.mobile_app_ваш_телефон",
            },
        )

    def _get_notify_services(self) -> list[str]:
        try:
            services = self.hass.services.async_services().get("notify", {})
            return [f"notify.{k}" for k in sorted(services.keys())]
        except Exception:
            return []
