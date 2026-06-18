# SMS Gammu Viewer для Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇬🇧 [English version](README.md)

Нативная панель для просмотра входящих SMS прямо в Home Assistant. Работает с аддоном [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) и любым совместимым шлюзом на базе [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

После установки в сайдбаре появляется вкладка **SMS**. Сообщения хранятся во внутренней SQLite базе и автоматически удаляются с модема после получения.

---

## Возможности

- 💬 Диалоги по номерам — все SMS от одного отправителя в одном чате
- 🔢 Счётчик непрочитанных на иконке в сайдбаре (`sensor.sms_unread_count`)
- 🔔 Push-уведомления при новом SMS с переходом по нажатию (iOS и Android)
- 🔄 Автообновление чата — новые сообщения появляются без перезагрузки
- 📶 Страница статуса модема — сигнал, оператор, IMEI, память SIM, сброс модема
- 🗄 Хранилище внутри HA (SQLite) — SMS не зависят от памяти симки
- 🧩 Умная сборка multipart SMS — длинные сообщения собираются целиком
- 🔍 Поиск по номеру и тексту сообщения
- 🗑 Удаление отдельных сообщений и целых диалогов
- ⚙️ Настройка интервала опроса и уведомлений через UI HA
- 📱 Адаптив для мобилок — кнопка меню и кнопка назад
- 🗓 Разделители по датам в чате (Сегодня, Вчера, полная дата)

---

## Требования

- Home Assistant 2023.1+
- Запущенный аддон [sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons/tree/main/sms-gammu-gateway) с REST API на порту 5000
- Для push-уведомлений: приложение [Home Assistant Companion](https://companion.home-assistant.io/) на телефоне

> ⚠️ **Важно:** В настройках аддона sms-gammu-gateway **отключи автоматическую проверку сообщений** (`SMS_CHECK_INTERVAL` или аналогичный параметр). Иначе аддон и интеграция будут одновременно читать симку и SMS будут теряться. Всю логику опроса берёт на себя SMS Gammu Viewer.

---

## Установка

### Через HACS (рекомендуется)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BrainDeLook&repository=sms-gammu-viewer-ha&category=integration)

Или вручную:

1. Открой **HACS** в Home Assistant
2. Нажми ⋮ → **Пользовательские репозитории**
3. Вставь: `https://github.com/BrainDeLook/sms-gammu-viewer-ha` — Категория: **Интеграция**
4. Найди **SMS Gammu Viewer** → **Скачать**
5. Перезапусти Home Assistant

### Ручная установка

1. Скачай [последний релиз](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
2. Скопируй `custom_components/sms_gammu_viewer/` в `<config>/custom_components/`
3. Перезапусти Home Assistant

---

## Первоначальная настройка

1. Перейди в **Настройки → Устройства и службы → + Добавить интеграцию**
2. Найди **SMS Gammu Viewer**
3. Заполни форму:

| Поле | Описание | Пример |
|---|---|---|
| **Хост** | IP или hostname аддона | `localhost` или `192.168.1.100` |
| **Порт** | Порт REST API | `5000` |
| **Логин** | Логин аддона | `admin` |
| **Пароль** | Пароль аддона | `password` |

4. Нажми **Отправить** — интеграция проверит подключение
5. В сайдбаре появится иконка **SMS** (💬)

---

## Настройки (интервал опроса и уведомления)

Перейди в **Настройки → Устройства и службы → SMS Gammu Viewer → Настроить** (⚙️):

### Интервал опроса

Как часто проверять новые SMS. Минимум 5 секунд, рекомендуется 20–30 секунд.

> При получении SMS интеграция переходит в **режим активного сбора**: опрашивает модем каждые 3 секунды пока симка не будет пустой 5 опросов подряд (~15 секунд тишины). Обычный таймер на паузе.

### Уведомления на телефон

Выбери устройства из выпадающего списка всех доступных `notify.*` сервисов. Можно выбрать несколько.

Нажатие на уведомление открывает панель SMS напрямую.

**Если устройства нет в списке:**
- Перейди в **Инструменты разработчика → Сервисы** и начни вводить `notify.mobile_app_`
- Или проверь **Настройки → Устройства и службы → Mobile App**

---

## Страница статуса модема

Нажми кнопку 📱 в шапке панели SMS:

- 📶 Уровень сигнала с визуальной шкалой
- 🌐 Оператор и статус регистрации в сети
- 📟 Производитель, модель, прошивка, IMEI
- 💾 Использование памяти SIM и телефона + IMSI
- 🔄 Кнопка перезагрузки модема

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
       ↓ DELETE /sms/deleteall
SQLite база (/config/sms_gammu_viewer.db)
       ↓
Панель SMS  +  Push-уведомление  +  sensor.sms_unread_count
```

### Сборка длинных SMS

SMS длиннее 160 символов (латиница) или 70 (кириллица) оператор разбивает на части. Интеграция:

1. Получает первую часть → переходит в режим активного сбора
2. Опрашивает модем каждые **3 секунды**, каждую часть сразу удаляет с симки
3. После **5 пустых опросов (~15 сек)** — SMS считается полным
4. Если части приходят несколькими волнами в течение 2 минут — автоматически объединяет их
5. Сохраняет как одно сообщение, отправляет уведомление с полным текстом

---

## Совместимые аддоны

| Проект | Совместимость |
|---|---|
| [PavelVe/home-assistant-addons sms-gammu-gateway](https://github.com/PavelVe/home-assistant-addons) | ✅ |
| [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway) | ✅ |

---

## История изменений

### v2.2.0
- 🔄 Автообновление чата через polling событий каждые 4 секунды
- 📶 Страница статуса модема — сигнал, сеть, IMEI, память SIM, сброс
- 📱 Кнопка меню на мобилке для открытия сайдбара HA
- 🗓 Разделители по датам в чате (Сегодня, Вчера, полная дата)
- 🧩 Улучшенная сборка multipart SMS: объединение волн в пределах 2 минут
- 🔔 Исправлен переход по нажатию на уведомление на iOS

### v2.1.0
- 🔢 Сенсор счётчика непрочитанных (`sensor.sms_unread_count`) с badge в сайдбаре

### v2.0.0
- Первый релиз: диалоги, SQLite хранилище, config flow, сборка SMS, уведомления

---

## Лицензия

MIT
