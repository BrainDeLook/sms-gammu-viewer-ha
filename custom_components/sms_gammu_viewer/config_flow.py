"""Config flow и Options flow для SMS Gammu Viewer."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import (
    CONF_CALL_DEVICE,
    CONF_CALL_DIAL_TIMEOUT,
    CONF_CALL_DURATION,
    CONF_COLLECT_EMPTY_MAX,
    CONF_COLLECT_INTERVAL,
    CONF_HOST,
    CONF_LANGUAGE,
    CONF_NOTIFY_TARGETS,
    CONF_PASSWORD,
    CONF_POLL_INTERVAL,
    CONF_PORT,
    CONF_USERNAME,
    DEFAULT_CALL_DIAL_TIMEOUT,
    DEFAULT_CALL_DURATION,
    DEFAULT_COLLECT_EMPTY_MAX,
    DEFAULT_COLLECT_INTERVAL,
    DEFAULT_LANGUAGE,
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
                vol.Required(CONF_PASSWORD, default=DEFAULT_PASSWORD): TextSelector(
                    TextSelectorConfig(type=TextSelectorType.PASSWORD)
                ),
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
            targets = user_input.get(CONF_NOTIFY_TARGETS, [])
            call_device = user_input.get(CONF_CALL_DEVICE, "").strip()
            self.hass.config_entries.async_update_entry(
                self._entry,
                data={
                    **self._entry.data,
                    CONF_POLL_INTERVAL: int(user_input[CONF_POLL_INTERVAL]),
                    CONF_NOTIFY_TARGETS: targets,
                    CONF_CALL_DEVICE: call_device,
                    CONF_CALL_DIAL_TIMEOUT: int(user_input.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT)),
                    CONF_CALL_DURATION: int(user_input.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION)),
                    CONF_COLLECT_INTERVAL: int(user_input.get(CONF_COLLECT_INTERVAL, DEFAULT_COLLECT_INTERVAL)),
                    CONF_COLLECT_EMPTY_MAX: int(user_input.get(CONF_COLLECT_EMPTY_MAX, DEFAULT_COLLECT_EMPTY_MAX)),
                    CONF_LANGUAGE: user_input.get(CONF_LANGUAGE, DEFAULT_LANGUAGE),
                },
            )
            return self.async_create_entry(title="", data={})

        notify_options = self._get_notify_options()
        current_targets = self._entry.data.get(CONF_NOTIFY_TARGETS, [])

        # Фильтруем current_targets — убираем те что больше не существуют
        valid_values = {o["value"] for o in notify_options}
        current_targets = [t for t in current_targets if t in valid_values]

        schema_fields: dict = {
            vol.Required(
                CONF_POLL_INTERVAL,
                default=self._entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=5,
                    max=3600,
                    step=1,
                    mode=NumberSelectorMode.BOX,
                    unit_of_measurement="сек",
                )
            ),
        }

        if notify_options:
            schema_fields[vol.Optional(
                CONF_NOTIFY_TARGETS,
                default=current_targets,
            )] = SelectSelector(
                SelectSelectorConfig(
                    options=notify_options,
                    multiple=True,
                    mode=SelectSelectorMode.LIST,
                    sort=True,
                )
            )
        else:
            schema_fields[vol.Optional(
                CONF_NOTIFY_TARGETS,
                default=", ".join(current_targets),
            )] = str

        schema_fields[vol.Optional(
            CONF_CALL_DEVICE,
            default=self._entry.data.get(CONF_CALL_DEVICE, ""),
        )] = str

        schema_fields[vol.Optional(
            CONF_CALL_DIAL_TIMEOUT,
            default=self._entry.data.get(CONF_CALL_DIAL_TIMEOUT, DEFAULT_CALL_DIAL_TIMEOUT),
        )] = NumberSelector(
            NumberSelectorConfig(min=5, max=120, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="сек")
        )

        schema_fields[vol.Optional(
            CONF_CALL_DURATION,
            default=self._entry.data.get(CONF_CALL_DURATION, DEFAULT_CALL_DURATION),
        )] = NumberSelector(
            NumberSelectorConfig(min=5, max=300, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="сек")
        )

        schema_fields[vol.Optional(
            CONF_COLLECT_INTERVAL,
            default=self._entry.data.get(CONF_COLLECT_INTERVAL, DEFAULT_COLLECT_INTERVAL),
        )] = NumberSelector(
            NumberSelectorConfig(min=1, max=15, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="сек")
        )

        schema_fields[vol.Optional(
            CONF_COLLECT_EMPTY_MAX,
            default=self._entry.data.get(CONF_COLLECT_EMPTY_MAX, DEFAULT_COLLECT_EMPTY_MAX),
        )] = NumberSelector(
            NumberSelectorConfig(min=1, max=20, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="опросов")
        )

        schema_fields[vol.Optional(
            CONF_LANGUAGE,
            default=self._entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE),
        )] = SelectSelector(
            SelectSelectorConfig(
                options=[
                    {"value": "ru", "label": "Русский"},
                    {"value": "en", "label": "English"},
                ],
                mode=SelectSelectorMode.DROPDOWN,
            )
        )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(schema_fields),
            description_placeholders={
                "notify_count": str(len(notify_options)),
            },
        )

    def _get_notify_options(self) -> list[dict]:
        """Список notify сервисов в формате [{value, label}] для SelectSelector."""
        try:
            services = self.hass.services.async_services().get("notify", {})
            result = []
            for key in sorted(services.keys()):
                full = f"notify.{key}"
                # Делаем читаемый лейбл: mobile_app_iphone_daniil → iPhone Daniil
                label = key
                if key.startswith("mobile_app_"):
                    label = key[len("mobile_app_"):].replace("_", " ").title()
                elif key == "persistent_notification":
                    label = "Persistent Notification (HA)"
                else:
                    label = key.replace("_", " ").title()
                result.append({"value": full, "label": f"{label} ({full})"})
            return result
        except Exception:
            return []



