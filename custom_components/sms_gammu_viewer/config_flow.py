"""Config flow и Options flow для SMS Gammu Viewer."""
from __future__ import annotations

import uuid

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
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
    CALL_ENTITY_TYPE_BUTTON,
    CALL_ENTITY_TYPE_COVER,
    CONF_CALL_DEVICE,
    CONF_CALL_DIAL_TIMEOUT,
    CONF_CALL_DURATION,
    CONF_CALL_ENTITIES,
    CONF_COLLECT_EMPTY_MAX,
    CONF_COLLECT_INTERVAL,
    CONF_HOST,
    CONF_LANGUAGE,
    CONF_NOTIFY_TARGETS,
    CONF_SHOW_PANEL,
    CONF_SHOW_SIDEBAR_BADGE,
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
    DEFAULT_SHOW_PANEL,
    DEFAULT_SHOW_SIDEBAR_BADGE,
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
            client = GatewayClient(self.hass, user_input)
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
        self._editing_entity_id: str | None = None  # id редактируемой call-сущности

    async def async_step_init(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        """Главное меню Options flow: общие настройки или управление сущностями звонков.

        Текст всегда на английском, захардкожен напрямую. У HA frontend есть
        известный баг с переводом menu_options через strings.json именно для
        Options Flow (issue home-assistant/frontend#21887/#21889) — подписи
        пунктов остаются пустыми. Раз меню всего из двух статичных пунктов,
        проще оставить фиксированный английский текст, чем гоняться за
        нестабильным поведением системы переводов.
        """
        return self.async_show_menu(
            step_id="init",
            menu_options={
                "settings": "General settings",
                "call_entities": "Call entities (cover/button per phone number)",
            },
        )

    async def async_step_settings(
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
                    CONF_SHOW_PANEL: bool(user_input.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL)),
                    CONF_SHOW_SIDEBAR_BADGE: bool(
                        user_input.get(CONF_SHOW_SIDEBAR_BADGE, DEFAULT_SHOW_SIDEBAR_BADGE)
                    ),
                },
            )
            # ВАЖНО: async_create_entry(data=...) для OptionsFlow ПОЛНОСТЬЮ
            # заменяет entry.options, а не дополняет. Нужно явно сохранить
            # уже существующие call_entities, иначе они стираются.
            return self.async_create_entry(
                title="",
                data={CONF_CALL_ENTITIES: self._entry.options.get(CONF_CALL_ENTITIES, [])},
            )

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

        schema_fields[vol.Optional(
            CONF_SHOW_PANEL,
            default=self._entry.data.get(CONF_SHOW_PANEL, DEFAULT_SHOW_PANEL),
        )] = BooleanSelector()

        schema_fields[vol.Optional(
            CONF_SHOW_SIDEBAR_BADGE,
            default=self._entry.data.get(
                CONF_SHOW_SIDEBAR_BADGE, DEFAULT_SHOW_SIDEBAR_BADGE
            ),
        )] = BooleanSelector()

        return self.async_show_form(
            step_id="settings",
            data_schema=vol.Schema(schema_fields),
        )

    # ─── Управление call-сущностями (cover/button для звонков) ────────

    async def async_step_call_entities(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        """Список существующих call-сущностей + кнопка добавить новую."""
        entities = self._entry.options.get(CONF_CALL_ENTITIES, [])

        if user_input is not None:
            action = user_input.get("action")
            if action == "add":
                self._editing_entity_id = None
                return await self.async_step_call_entity_form()
            if action and action.startswith("edit:"):
                self._editing_entity_id = action[len("edit:"):]
                return await self.async_step_call_entity_form()
            if action and action.startswith("delete:"):
                entity_id = action[len("delete:"):]
                new_entities = [e for e in entities if e["id"] != entity_id]
                self.hass.config_entries.async_update_entry(
                    self._entry,
                    options={**self._entry.options, CONF_CALL_ENTITIES: new_entities},
                )
                return await self.async_step_call_entities()
            if action == "done":
                return self.async_create_entry(
                    title="",
                    data={CONF_CALL_ENTITIES: entities},
                )

        lang = self._entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)
        texts = {
            "ru": {"add": "➕ Добавить сущность", "done": "✅ Готово"},
        }.get(lang, {"add": "➕ Add entity", "done": "✅ Done"})

        options_list = [{"value": "add", "label": texts["add"]}]
        for e in entities:
            kind = "🚪 Cover" if e["entity_type"] == CALL_ENTITY_TYPE_COVER else "🔘 Button"
            options_list.append({
                "value": f"edit:{e['id']}",
                "label": f"{kind} — {e['name']} ({e['number']})",
            })
        if entities:
            options_list.append({"value": "done", "label": texts["done"]})

        return self.async_show_form(
            step_id="call_entities",
            data_schema=vol.Schema({
                vol.Required("action"): SelectSelector(
                    SelectSelectorConfig(
                        options=options_list,
                        mode=SelectSelectorMode.LIST,
                    )
                ),
            }),
        )

    async def async_step_call_entity_form(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        """Форма добавления/редактирования одной call-сущности."""
        entities = self._entry.options.get(CONF_CALL_ENTITIES, [])
        editing = None
        if self._editing_entity_id:
            editing = next((e for e in entities if e["id"] == self._editing_entity_id), None)

        errors: dict[str, str] = {}

        if user_input is not None:
            if user_input.get("_delete"):
                new_entities = [e for e in entities if e["id"] != self._editing_entity_id]
                self.hass.config_entries.async_update_entry(
                    self._entry,
                    options={**self._entry.options, CONF_CALL_ENTITIES: new_entities},
                )
                return await self.async_step_call_entities()

            name = user_input.get("name", "").strip()
            number = user_input.get("number", "").strip()
            if not name:
                errors["name"] = "name_required"
            if not number:
                errors["number"] = "number_required"

            if not errors:
                entity_data = {
                    "id": editing["id"] if editing else str(uuid.uuid4())[:8],
                    "entity_type": user_input["entity_type"],
                    "name": name,
                    "number": number,
                    "dial_timeout": int(user_input.get("dial_timeout", DEFAULT_CALL_DIAL_TIMEOUT)),
                    "call_duration": int(user_input.get("call_duration", DEFAULT_CALL_DURATION)),
                    "auto_close": user_input.get("auto_close", True),
                }
                if editing:
                    new_entities = [
                        entity_data if e["id"] == editing["id"] else e
                        for e in entities
                    ]
                else:
                    new_entities = entities + [entity_data]

                self.hass.config_entries.async_update_entry(
                    self._entry,
                    options={**self._entry.options, CONF_CALL_ENTITIES: new_entities},
                )
                return await self.async_step_call_entities()

        schema_fields = {
            vol.Required(
                "entity_type",
                default=editing["entity_type"] if editing else CALL_ENTITY_TYPE_COVER,
            ): SelectSelector(
                SelectSelectorConfig(
                    options=[
                        {"value": CALL_ENTITY_TYPE_COVER, "label": "Cover (открыть/закрыть, например шлагбаум/ворота)"},
                        {"value": CALL_ENTITY_TYPE_BUTTON, "label": "Button (просто кнопка «Позвонить»)"},
                    ],
                    mode=SelectSelectorMode.DROPDOWN,
                )
            ),
            vol.Required("name", default=editing["name"] if editing else ""): str,
            vol.Required("number", default=editing["number"] if editing else ""): str,
            vol.Optional(
                "dial_timeout",
                default=editing.get("dial_timeout", DEFAULT_CALL_DIAL_TIMEOUT) if editing else DEFAULT_CALL_DIAL_TIMEOUT,
            ): NumberSelector(
                NumberSelectorConfig(min=5, max=120, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="сек")
            ),
            vol.Optional(
                "call_duration",
                default=editing.get("call_duration", DEFAULT_CALL_DURATION) if editing else DEFAULT_CALL_DURATION,
            ): NumberSelector(
                NumberSelectorConfig(min=5, max=300, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="сек")
            ),
            vol.Optional(
                "auto_close",
                default=editing.get("auto_close", True) if editing else True,
            ): bool,
        }
        if editing:
            schema_fields[vol.Optional("_delete", default=False)] = bool

        return self.async_show_form(
            step_id="call_entity_form",
            data_schema=vol.Schema(schema_fields),
            errors=errors,
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











