# SMS Gammu Viewer для Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇬🇧 [English version](README.md)

Нативная панель для просмотра входящих SMS прямо в Home Assistant. Работает с аддоном [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) и любым совместимым шлюзом на базе [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

После установки в сайдбаре появляется вкладка **SMS** со списком всех диалогов. SMS хранятся внутри Home Assistant и не зависят от памяти симки — после получения они автоматически удаляются с модема.

---

## Возможности

- 💬 Диалоги по номерам — все SMS от одного отправителя в одном чате
- 🔵 Подсветка и счётчик непрочитанных сообщений
- 🔍 Поиск по номеру и тексту сообщения
- 🗄 Хранилище внутри HA (SQLite) — SMS не теряются при переполнении симки
- 🔄 Умный сбор multipart SMS — длинные сообщения собираются целиком перед показом
- 📲 Push-уведомления на телефон при новом SMS
- 🗑 Удаление отдельных сообщений и целых диалогов
- ⚙️ Настройка интервала опроса прямо из интерфейса HA
- 📶 Статус сигнала и оператора в панели

---

## Требования

- Home Assistant 2023.1+
- Запущенный аддон [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) с REST API на порту 5000
- Для push-уведомлений: приложение [Home Assistant Companion](https://companion.home-assistant.io/) на телефоне

> ⚠️ **Важно:** В настройках аддона sms-gammu-gateway необходимо **отключить автоматическую проверку сообщений** (параметр `SMS_CHECK_INTERVAL` или аналогичный). Иначе аддон и эта интеграция будут одновременно читать и удалять SMS с симки, что приведёт к потере сообщений. Всю логику опроса берёт на себя SMS Gammu Viewer.

---

## Установка

### Через HACS (рекомендуется)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Или вручную:

1. Открой **HACS** в Home Assistant
2. Нажми три точки (⋮) в правом верхнем углу → **Пользовательские репозитории**
3. Вставь URL: `https://github.com/BrainDeLook/sms-gammu-viewer-ha`
4. Категория: **Интеграция** → нажми **Добавить**
5. Найди **SMS Gammu Viewer** → нажми **Скачать**
6. Перезапусти Home Assistant

### Ручная установка

1. Скачай [последний релиз](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
2. Скопируй папку `custom_components/sms_gammu_viewer/` в `<config>/custom_components/`
3. Перезапусти Home Assistant

---

## Первоначальная настройка

После перезапуска HA:

1. Перейди в **Настройки → Устройства и службы**
2. Нажми **+ Добавить интеграцию**
3. Найди **SMS Gammu Viewer**
4. Заполни форму:

| Поле | Описание | Пример |
|---|---|---|
| **Хост** | IP-адрес или hostname где запущен аддон | `localhost` или `192.168.1.100` |
| **Порт** | Порт REST API аддона | `5000` |
| **Логин** | Логин от аддона | `admin` |
| **Пароль** | Пароль от аддона | `password` |

> Если аддон запущен на том же устройстве что и HA — используй `localhost`. Если на другом — укажи его IP.

5. Нажми **Отправить** — интеграция проверит подключение
6. В сайдбаре появится иконка **SMS** (💬)

---

## Настройки (интервал опроса и уведомления)

Чтобы изменить интервал опроса или добавить устройства для push-уведомлений:

1. Перейди в **Настройки → Устройства и службы**
2. Найди карточку **SMS Gammu Viewer**
3. Нажми **Настройть** (иконка шестерёнки ⚙️)

### Интервал опроса

Как часто интеграция проверяет наличие новых SMS на модеме. Минимум — 5 секунд, рекомендуется 20–30 секунд.

> При получении SMS интеграция автоматически переходит в режим активного сбора: опрашивает модем каждые 3 секунды пока не убедится что все части длинного сообщения получены. Обычный таймер в это время на паузе.

### Уведомления на телефон

Поле **«Устройства для уведомлений»** — впиши сервисы notify каждый с новой строки.

**Как узнать название своего устройства:**

1. Установи приложение [Home Assistant](https://companion.home-assistant.io/) на телефон и войди в свой HA
2. Перейди в **Настройки → Устройства и службы → Интеграции**
3. Найди интеграцию **Mobile App** и открой её
4. Там увидишь своё устройство, например `iPhone Daniil`
5. Название сервиса формируется автоматически: пробелы → подчёркивания, всё в нижнем регистре

Например, если устройство называется `iPhone Daniil` → сервис будет `notify.mobile_app_iphone_daniil`

Либо можно найти точное название через **Инструменты разработчика → Сервисы**: начни вводить `notify.mobile_app_` и увидишь все доступные устройства.

**Пример заполнения поля (несколько устройств):**
```
notify.mobile_app_iphone_daniil
notify.mobile_app_samsung_galaxy_s24
```

После сохранения при каждом новом SMS на все указанные устройства придёт уведомление вида:
```
Новое SMS
От: +79001234567
Текст: Текст сообщения...
```

Нажатие на уведомление откроет панель SMS в Home Assistant.

---

## Как это работает

```
Телефон отправителя
       ↓ SMS
GSM модем (USB)
       ↓
sms-gammu-gateway (REST API :5000)
       ↓ GET /sms  (каждые N сек, или каждые 3 сек в режиме сбора)
SMS Gammu Viewer (custom component)
       ↓ DELETE /sms/deleteall  (удаляет с симки)
SQLite база внутри HA (/config/sms_gammu_viewer.db)
       ↓
Панель SMS в сайдбаре  +  Push-уведомление на телефон
```

### Сборка длинных SMS

Длинные SMS (>160 символов латиницы или >70 кириллицы) оператор разбивает на части и доставляет по одной. Интеграция:

1. Видит первую часть → переходит в режим активного сбора
2. Опрашивает модем каждые **3 секунды**
3. Каждую полученную часть добавляет в буфер и сразу удаляет с симки
4. Когда 10 опросов подряд симка пустая (≈30 секунд тишины) — считает SMS полностью полученным
5. Склеивает все части и сохраняет как одно сообщение

---

## Совместимые аддоны / шлюзы

| Проект | Совместимость |
|---|---|
| [PavelVe/home-assistant-addons sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons) | ✅ |
| [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) | ✅ |

---

## Лицензия

MIT
