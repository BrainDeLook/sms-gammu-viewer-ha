# SMS Gammu Viewer — нативная панель для Home Assistant

Добавляет вкладку **SMS** в сайдбар Home Assistant для просмотра входящих сообщений с GSM-модема через аддон [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) (или совместимый pajikos/sms-gammu-gateway).

## Установка

### 1. Скопируй файлы

```
config/
├── custom_components/
│   └── sms_gammu_viewer/
│       ├── __init__.py
│       └── manifest.json
└── www/
    └── sms_gammu_viewer/
        └── panel.js
```

### 2. Добавь в `configuration.yaml`

```yaml
sms_gammu_viewer:
  host: localhost       # адрес где запущен аддон (localhost если на том же хосте)
  port: 5000
  username: admin
  password: password
```

Если аддон запущен на том же хосте — `localhost` подойдёт. Если на другом устройстве — укажи его IP.

### 3. Перезапусти Home Assistant

После перезапуска в сайдбаре появится иконка **SMS** (mdi:message-text).

## Что умеет

- Список всех входящих SMS с датой, номером и превью
- Подсветка непрочитанных сообщений
- Фильтрация: все / только непрочитанные
- Поиск по номеру и тексту
- Детальный просмотр сообщения
- Автообновление каждые 30 секунд
- Ручное обновление кнопкой
- Адаптивная вёрстка

## API

Компонент обращается к аддону через прокси `/api/sms_gammu_viewer/sms`, чтобы не раскрывать Basic Auth в браузере. Все запросы проходят через HA с проверкой авторизации HA.

## Требования

- Home Assistant 2023.1+
- Запущенный аддон sms-gammu-gateway (REST API на порту 5000)
