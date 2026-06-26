# SMS Gammu Viewer для Home Assistant

Интеграция для просмотра SMS и совершения звонков через [gammu-gateway](https://github.com/BrainDeLook/gammu-gateway).

## Возможности

- 💬 **SMS** — входящие, отправка, удаление переписок
- 📞 **Звонки** — исходящие через модем (AT-команды)
- 📖 **Телефонная книга** — контакты с именами и метками
- 📌 **Закрепление чатов** — закреплённые всегда сверху
- 🔇 **Без звука** — отключение уведомлений по контакту
- 📱 **Свайпы на мобиле** — свайп влево/вправо по чату (заглушить, удалить, прочитать, закрепить)
- 🌐 **Локализация** — русский и английский интерфейс
- 🏠 **Сенсоры HA** — количество непрочитанных, номер и текст последнего SMS

## Требования

- Home Assistant 2024.1+
- [gammu-gateway](https://github.com/BrainDeLook/gammu-gateway) запущен и доступен по HTTP
- USB GSM модем поддерживаемый Gammu

## Установка

### Через HACS (рекомендуется)
1. Добавить этот репозиторий как custom repository в HACS
2. Установить **SMS Gammu Viewer**
3. Перезапустить Home Assistant
4. Настройки → Интеграции → Добавить → **SMS Gammu Viewer**

### Вручную
```bash
cp -r custom_components/sms_gammu_viewer /config/custom_components/
```
Перезапустить Home Assistant, затем добавить интеграцию.

## Настройка

| Поле | Описание |
|------|----------|
| Host | IP/хост gammu-gateway |
| Port | Порт gammu-gateway (по умолчанию 5000) |
| Username / Password | Учётные данные HTTP Basic Auth |
| Poll interval | Интервал опроса новых SMS (секунды) |
| Call device | Серийное устройство для AT-команд (опционально) |

## Сенсоры

| Сущность | Описание |
|----------|----------|
| `sensor.sms_unread_count` | Количество непрочитанных сообщений |
| `sensor.sms_last_sms_number` | Номер отправителя последнего SMS |
| `sensor.sms_last_sms_text` | Текст последнего SMS |

## События

- `sms_gammu_viewer_sms_sent` — срабатывает при отправке SMS

## История изменений

См. [Releases](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases).
