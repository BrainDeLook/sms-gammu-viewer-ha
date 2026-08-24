"""Constants."""

DOMAIN = "sms_gammu_viewer"

PANEL_URL = "sms-viewer"
PANEL_TITLE = "SMS"
PANEL_ICON = "mdi:message-text"
FRONTEND_PATH = "frontend"

CONF_HOST = "host"
CONF_PORT = "port"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_POLL_INTERVAL = "poll_interval"
CONF_NOTIFY_TARGETS = "notify_targets"

DEFAULT_PORT = 5000
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "password"
DEFAULT_POLL_INTERVAL = 30

DB_FILENAME = "sms_gammu_viewer.db"

# Опциональный голосовой интерфейс модема (например /dev/serial/by-id/...-if02-port0)
CONF_CALL_DEVICE = "call_device"
CONF_CALL_DIAL_TIMEOUT = "call_dial_timeout"
CONF_CALL_DURATION = "call_duration"

DEFAULT_CALL_DIAL_TIMEOUT = 25
DEFAULT_CALL_DURATION = 30

EVENT_CALL_ENDED = f"{DOMAIN}_call_ended"
EVENT_SMS_RECEIVED = f"{DOMAIN}_sms_received"
EVENT_SMS_SENT = f"{DOMAIN}_sms_sent"

# Номер телефона самой SIM-карты — оператор не всегда хранит его на симке,
# поэтому вводится вручную, не определяется автоматически
CONF_SIM_PHONE_NUMBER = "sim_phone_number"

# Настройки стабилизации multipart SMS для шлюзов, которые пока не отдают
# метаданные Complete/PartsReceived/PartsExpected.
CONF_COLLECT_INTERVAL = "collect_interval"
CONF_COLLECT_EMPTY_MAX = "collect_empty_max"

DEFAULT_COLLECT_INTERVAL = 2
DEFAULT_COLLECT_EMPTY_MAX = 5

# Язык интерфейса панели — настраивается централизованно через Options flow
CONF_LANGUAGE = "language"
DEFAULT_LANGUAGE = "ru"

# Виртуальные сущности для звонков (cover/button), создаваемые через config flow.
# Хранятся списком словарей в entry.options[CONF_CALL_ENTITIES]:
#   {id, entity_type, name, number, dial_timeout, call_duration,
#    auto_close (только для cover)}
CONF_CALL_ENTITIES = "call_entities"

CALL_ENTITY_TYPE_COVER = "cover"
CALL_ENTITY_TYPE_BUTTON = "button"

# Показывать ли панель в сайдбаре HA
CONF_SHOW_PANEL = "show_panel"
DEFAULT_SHOW_PANEL = True

# Показывать число непрочитанных SMS возле иконки панели в сайдбаре HA
CONF_SHOW_SIDEBAR_BADGE = "show_sidebar_badge"
DEFAULT_SHOW_SIDEBAR_BADGE = True

# Автоматические логотипы организаций для буквенных отправителей.
CONF_USE_BRAND_LOGOS = "use_brand_logos"
DEFAULT_USE_BRAND_LOGOS = False

# Префикс action в мобильном уведомлении для ответа на SMS:
# полное имя action = префикс + номер отправителя
NOTIFY_ACTION_REPLY_PREFIX = "SMS_GAMMU_REPLY_"
