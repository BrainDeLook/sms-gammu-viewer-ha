# SMS Gammu Viewer для Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/BrainDeLook/sms-gammu-viewer-ha?style=for-the-badge)](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases)
[![License](https://img.shields.io/github/license/BrainDeLook/sms-gammu-viewer-ha.svg?style=for-the-badge)](LICENSE)

> 🇬🇧 [English version](README.md)

Нативная панель для SMS-переписки и голосовых звонков прямо в Home Assistant. Работает с любым шлюзом на базе [gammu-gateway](https://github.com/pajikos/sms-gammu-gateway).

<p align="center">
  <img src="screenshots/desktop.jpg" alt="Вид на ПК" width="70%"><br>
  <sub>Десктоп — список диалогов, переписка, поле отправки</sub>
</p>

---

## Возможности

### 💬 Сообщения
- Диалоги по номерам — все SMS от одного отправителя в одном чате
- Отправка SMS из чата или новый диалог через кнопку `+`
- Счётчик символов с учётом лимитов GSM (160 латиница / 70 кириллица), показывает количество частей
- Поиск по номеру телефона или тексту сообщения
- **Долгое нажатие** на сообщение (мобиле) или **правый клик** (десктоп) — копировать, избранное ⭐, удалить
- **Свайпы** (мобиль ≤580px) — влево: заглушить / удалить, вправо: прочитать / закрепить
- **Фильтр избранного** — кнопка в шапке чата для показа только отмеченных сообщений

### 📞 Звонки
- Исходящие голосовые звонки через AT-интерфейс (модемы с несколькими serial-портами, например Huawei)
- Сервисы `sms_gammu_viewer.call` / `sms_gammu_viewer.hangup` для автоматизаций
- **Сущности звонков** — `cover`/`button` сущности, звонящие на фиксированный номер, для ворот и домофонов

### 📇 Контакты
- Телефонная книга — имена контактов отображаются в списке чатов, истории звонков и шапке чата
- **Закрепление чатов** — закреплённые всегда сверху; кнопка при наведении на десктопе, свайп на мобиле
- **Без звука** — отключение push-уведомлений для конкретного номера, сообщения продолжают сохраняться

### 📡 Мониторинг модема
- Страница статуса — сигнал, сеть, SIM, память, прошивка, IMEI
- Блок хранилища — размер базы данных и количество сообщений, кнопка очистки
- Автоматическое восстановление модема — сброс после повторных ошибок с предупреждением в статус-баре
- Мгновенная загрузка статуса — кешированный ответ, спиннер при обновлении

### 🏠 Интеграция с HA
- Push-уведомления при новых SMS с возможностью открыть чат (iOS и Android), группировка по отправителю
- Интерфейс на русском и английском, переключается независимо от языка HA

### 📱 Мобильный интерфейс
- Скруглённые чаты с обводкой, без разделителей
- Отступ снизу чтобы последний чат не перекрывался кнопками
- Свайп только от края (40px) для защиты от случайных касаний
- Оптимистичные обновления — закреп, mute, прочитано применяются мгновенно

---

## Требования

- Home Assistant 2024.3+
- **[Аддон SMS Gammu Gateway](https://github.com/pavelivanov00/sms-gammu-gateway)** от Pavel Ivanov — установить через магазин дополнений Home Assistant, это шлюз который общается с модемом
- USB GSM модем, поддерживаемый Gammu (например Huawei E1550, E3372, ZTE MF823)
- Для push-уведомлений: приложение [Home Assistant Companion](https://companion.home-assistant.io/)

> Аддон предоставляет REST API к которому подключается интеграция. Без него интеграция не работает.

---

## Установка

### Через HACS (рекомендуется)
1. Добавить этот репозиторий как **Custom Repository** в HACS → Интеграции
2. Установить **SMS Gammu Viewer**
3. Перезапустить Home Assistant
4. Настройки → Интеграции → Добавить → **SMS Gammu Viewer**

### Вручную
```bash
cp -r custom_components/sms_gammu_viewer /config/custom_components/
```
Перезапустить Home Assistant, затем добавить интеграцию.

---

## Настройка

| Поле | Описание |
|------|----------|
| Host | IP/хост gammu-gateway |
| Port | Порт gammu-gateway (по умолчанию 5000) |
| Username / Password | Учётные данные HTTP Basic Auth |
| Poll interval | Интервал опроса новых SMS (секунды) |
| Call device | Серийное устройство для AT-команд (опционально) |

---

## Сенсоры

| Сущность | Описание | Обновление |
|----------|----------|------------|
| `sensor.sms_unread_count` | Количество непрочитанных | При новом SMS |
| `sensor.sms_last_sms_number` | Номер отправителя последнего SMS | При новом SMS |
| `sensor.sms_last_sms_text` | Текст последнего SMS | При новом SMS |
| `sensor.signal_quality` | Качество сигнала модема, % | Каждые 10 сек |
| `sensor.network_operator` | Название оператора (Beeline, МТС…) | Каждые 10 сек |

---

## Счётчик непрочитанных в сайдбаре (через custom-sidebar)

Home Assistant не поддерживает badge на иконках панелей нативно. Можно добавить через HACS плагин [custom-sidebar](https://github.com/elchininet/custom-sidebar).

> ⚠️ **Важно:** как только вы добавляете элемент в конфиг custom-sidebar, он берёт управление порядком сайдбара на себя. Вы теряете возможность менять порядок через UI HA — нужно прописывать все элементы вручную.

**1. Установи custom-sidebar** через HACS → Frontend.

**2. Добавь в `configuration.yaml`:**
```yaml
frontend:
  extra_module_url:
    - /hacsfiles/custom-sidebar/custom-sidebar-plugin.js
```

**3. Создай `/config/www/custom-sidebar-config.yaml`:**
```yaml
order:
  - item: /sms-viewer
    match: href
    notification: |
      [[[
        const count = parseInt(states['sensor.sms_unread_count']?.state) || 0;
        return count > 0 ? String(count) : '';
      ]]]
```

> Чтобы найти точный `href` панели SMS, добавь `?cs_debug` к URL твоего HA и проверь консоль браузера → `custom-sidebar debug: Top Native sidebar items`.

**4. Перезапусти Home Assistant.**

---

## История изменений

См. [Releases](https://github.com/BrainDeLook/sms-gammu-viewer-ha/releases).

---

## Благодарности

Построено на базе [pajikos/sms-gammu-gateway](https://github.com/pajikos/sms-gammu-gateway). Создано из желания иметь нормальный SMS-интерфейс прямо в Home Assistant без внешних приложений.
