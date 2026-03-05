# StarLine Remote — Amazfit GTR 4

Управление сигнализацией **StarLine S96 / S9** с умных часов **Amazfit GTR 4** (Zepp OS 2.0).

Запуск двигателя, постановка/снятие с охраны, температура в салоне — всё прямо с запястья.

---

## Возможности

- **Запуск / остановка двигателя** — с экраном подтверждения и настраиваемым таймером прогрева
- **Охрана** — постановка и снятие одной кнопкой
- **Статус** — состояние двигателя, режим охраны, температура в салоне
- **Виброотклик** — успех или ошибка команды
- **Кеш токена** — авторизация кешируется на 4 часа, обновляется автоматически
- **Защита от случайного нажатия** — экран подтверждения перед запуском двигателя

---

## Архитектура

```
[Amazfit GTR 4 — Device App]
         ↕ Bluetooth LE (MessageBuilder)
[Смартфон — Zepp App — Side Service]
         ↕ HTTPS
[StarLine Cloud API — dev.starline.ru]
         ↕
[StarLine S96 / S9 в машине]
```

Часы **не имеют прямого доступа в интернет** — все HTTP-запросы идут через Side Service внутри приложения Zepp на телефоне. Телефон должен находиться в зоне Bluetooth от часов (~10 м).

---

## Требования

| Компонент | Версия |
|---|---|
| Amazfit GTR 4 | Zepp OS 2.0 / API Level 2.0 |
| Zepp App | Android / iOS — с включённым Режимом разработчика |
| Zeus CLI | `npm install -g @zeppos/zeus-cli` |
| Node.js | >= 18 |

Также необходимо:
- Аккаунт на [my.starline.ru](https://my.starline.ru) с привязанным устройством S96 / S9
- Зарегистрированное приложение на [developer.starline.ru](https://developer.starline.ru) → получить **App ID** и **Secret Key**

---

## Установка и запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/<your-username>/starline-zepp.git
cd starline-zepp
npm install
```

### 2. Авторизоваться в Zeus

```bash
npx @zeppos/zeus-cli@latest login
```

### 3. Собрать приложение

```bash
npm run build
```

### 4. Установить на часы

Включить **Режим разработчика** в Zepp App: Профиль → несколько тапов по номеру версии.

```bash
npm run preview
# Выбрать: Amazfit GTR 4
# Отсканировать QR-код в Zepp App
```

---

## Настройка (Settings App)

После установки открыть **Настройки** приложения в Zepp App:

| Поле | Описание |
|---|---|
| Email | Логин аккаунта StarLine (my.starline.ru) |
| Пароль | Пароль от аккаунта StarLine |
| App ID | ID приложения с developer.starline.ru |
| Secret Key | Секретный ключ с developer.starline.ru |
| — | Нажать **«Войти и получить список устройств»** |
| ID устройства | Скопировать ID своего автомобиля из списка |
| Время прогрева | Таймер прогрева в минутах (по умолчанию 10) |

---

## Структура проекта

```
starline-zepp/
├── app.js                          # Точка входа, инициализация MessageBuilder
├── app.json                        # Манифест приложения
├── assets/app/
│   ├── icon.png                    # Иконка приложения
│   └── cover.png                   # Обложка для Zepp App
├── device-app/
│   ├── pages/
│   │   ├── main.js                 # Главный экран: статус и кнопки управления
│   │   └── confirm.js              # Экран подтверждения запуска двигателя
│   └── shared/
│       ├── message.js              # MessageBuilder (device-side BLE)
│       ├── device-polyfill.js      # Promise polyfill для Zepp OS
│       ├── es6-promise.js          # ES6 Promise implementation
│       ├── defer.js                # Deferred / timeout helpers
│       └── data.js                 # Buffer ↔ JSON helpers
├── side-service/
│   ├── index.js                    # HTTP-клиент: авторизация StarLine, команды
│   └── shared/
│       ├── message-side.js         # MessageBuilder (phone-side BLE)
│       ├── event.js                # EventBus
│       ├── defer.js                # Deferred / timeout helpers
│       └── data.js                 # Buffer ↔ JSON helpers
├── settings-app/
│   └── index.js                    # Настройки: credentials, выбор устройства
└── .github/workflows/
    └── build.yml                   # CI: сборка ZAB и GitHub Release
```

---

## StarLine API

Используется официальный REST API. Авторизация — 3 шага:

```
1. GET  id.starline.ru/apiV3/application/getToken?appId=...&secret=...
2. POST id.starline.ru/apiV3/user/login   { login, pass: sha1(password) }
3. POST dev.starline.ru/json/v2/auth.slid → Set-Cookie: slnet=...
```

Управление:

```
GET  dev.starline.ru/json/v2/device/{id}/common_info      # статус
POST dev.starline.ru/json/v2/device/{id}/set_param
     { r_start: 1, r_timer: 10 }   # запуск (прогрев 10 мин)
     { r_start: 0 }                # остановка
     { alarm: 1 }                  # поставить на охрану
     { alarm: 0 }                  # снять с охраны
```

> **Лимит:** ~1000 запросов в сутки. Статус обновляется не чаще раза в 90 секунд.

---

## CI / CD

GitHub Actions собирает `.zab` на каждый push в `main`.
При создании тега `v*` — автоматически создаётся GitHub Release.

Необходимый секрет: **`ZEUS_CONFIG`** — содержимое `~/.zepp/.zeus` в base64:

```bash
base64 -w0 ~/.zepp/.zeus
```

Settings → Secrets and variables → Actions → **New repository secret** → `ZEUS_CONFIG`.

---

## Лицензия

MIT
