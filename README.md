# SMS Gammu Viewer for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

Нативная панель для просмотра входящих SMS прямо в Home Assistant. Работает с аддоном [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) и любым совместимым шлюзом на базе [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

После установки в сайдбаре появляется вкладка **SMS** со списком всех входящих сообщений.

---

## Возможности

- 📋 Список всех входящих SMS с датой, номером и превью текста
- 🔵 Подсветка непрочитанных сообщений
- 🔍 Поиск по номеру и тексту
- 🗂 Фильтр: все / только непрочитанные
- 🔄 Автообновление каждые 30 секунд + кнопка ручного обновления
- 🔒 Прокси через HA — Basic Auth аддона не раскрывается браузеру
- 📱 Адаптивная вёрстка

---

## Требования

- Home Assistant 2023.1+
- Запущенный аддон [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) с REST API на порту 5000

---

## Установка

### HACS (рекомендуется)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Или вручную:

1. Открой HACS в Home Assistant
2. Нажми три точки (⋮) → **Custom repositories**
3. Вставь URL: `https://github.com/BrainDeLook/sms-gammu-viewer-ha`
4. Категория: **Integration**
5. Нажми **Add** → найди **SMS Gammu Viewer** → **Download**
6. Перезапусти Home Assistant

### Ручная установка

1. Скачай [последний релиз](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
2. Скопируй папку `custom_components/sms_gammu_viewer/` в `<config>/custom_components/`
3. Скопируй папку `www/sms_gammu_viewer/` в `<config>/www/`
4. Перезапусти Home Assistant

---

## Настройка

Добавь в `configuration.yaml`:

```yaml
sms_gammu_viewer:
  host: localhost    # IP или hostname где запущен аддон
  port: 5000
  username: admin
  password: password
```

Если аддон запущен на том же хосте что и HA — используй `localhost`. Для другого устройства — укажи его IP-адрес.

После перезапуска HA в сайдбаре появится иконка **SMS** (💬).

---

## Как это работает

```
Браузер  ──→  HA WebSocket/HTTP  ──→  Python прокси  ──→  sms-gammu-gateway :5000
                  (авторизация HA)        (Basic Auth)            (REST API)
```

Компонент регистрирует:
- **Прокси-endpoint** `/api/sms_gammu_viewer/sms` — проксирует запросы к аддону, скрывая Basic Auth
- **Нативную панель** в сайдбаре через `panel_custom` — Web Component без внешних зависимостей

---

## Совместимые аддоны / шлюзы

| Проект | Совместимость |
|---|---|
| [PavelVe/home-assistant-addons sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons) | ✅ |
| [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) | ✅ |
| [BigThunderSR/ha-legacy-gsm-sms](https://github.com/BigThunderSR/ha-legacy-gsm-sms) | ✅ |

---

## Лицензия

MIT
