# SERVIX

[Русский](README.md) | [English](README.en.md)

SERVIX - self-hosted панель для учета серверов, доменов, сертификатов, провайдеров, платежей и сроков действия услуг.

Проект работает на Node.js, SQLite и Vue. Данные хранятся локально в папке `data`, уведомления отправляются в Telegram, а интерфейс можно установить как PWA-приложение через браузер.

## Возможности

- учет серверов, доменов и сертификатов;
- отдельные поля для каждого типа записи;
- провайдеры с кабинетом, favicon, цветом и заметками;
- платежи в USDT для каждой записи;
- статистика по серверным платежам, периодам и провайдерам;
- таблицы с поиском, сортировкой, пагинацией и экспортом;
- Telegram-уведомления по периодам `5m`, `2h`, `1d`, `3d`, `5d`;
- realtime-планирование уведомлений без постоянного часового опроса;
- авторизация по логину и паролю;
- опциональная 2FA-аутентификация через приложение-аутентификатор;
- журнал действий в `data/access.log`;
- темный адаптивный интерфейс;
- русский и английский интерфейс через i18n;
- установка как приложение через `manifest.webmanifest`.

## Требования

Для Docker-запуска:

- Docker;
- Docker Compose.

Для локального запуска без Docker:

- Node.js `24+`;
- npm.

## Быстрый запуск через Docker

```bash
git clone https://github.com/sansepro/servix.git
cd servix
docker compose up -d --build
```

После запуска откройте:

```text
http://localhost:3000
```

При первом входе SERVIX покажет страницу создания пользователя. Нужно указать только логин, пароль и повтор пароля.

## Пример docker-compose.yml

```yaml
services:
  servix:
    build: .
    container_name: servix
    ports:
      - "3000:3000"
    environment:
      SITE_TITLE: "SERVIX"
      DATA_DIR: "/app/data"
      APP_TIMEZONE: "Europe/Moscow"
      TELEGRAM_NOTIFY_URL: "tgram://TOKEN/CHAT_ID:TOPIC_ID"
      NOTIFY_ON_START: "true"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Если Telegram-топик не используется:

```yaml
TELEGRAM_NOTIFY_URL: "tgram://TOKEN/CHAT_ID"
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `PORT` | `3000` | Порт внутри контейнера или локального Node.js процесса. |
| `SITE_TITLE` | `SERVIX` | Название панели при первом запуске. Потом можно изменить в настройках. |
| `DATA_DIR` | `./data` | Папка с SQLite-базой и логами. |
| `APP_TIMEZONE` | `Europe/Moscow` | Таймзона приложения при первом запуске. Потом можно изменить в настройках. |
| `TELEGRAM_NOTIFY_URL` | пусто | URL для Telegram-уведомлений при первом запуске. Потом можно изменить в настройках. |
| `NOTIFY_ON_START` | `true` | Отправлять ближайшие актуальные уведомления после старта приложения. |
| `COOKIE_SECURE` | пусто | Установите `true`, если приложение работает за HTTPS reverse proxy. |

Настройки `SITE_TITLE`, `APP_TIMEZONE`, `TELEGRAM_NOTIFY_URL`, `NOTIFY_ON_START` сохраняются в базе. После первого запуска удобнее менять их через страницу настроек.

## Локальный запуск без Docker

```bash
git clone https://github.com/sansepro/servix.git
cd servix
npm install
npm run build
npm start
```

Откройте:

```text
http://localhost:3000
```

Для разработки frontend можно использовать:

```bash
npm run dev
```

## Как пользоваться

1. Создайте аккаунт при первом запуске.
2. Откройте настройки и проверьте таймзону, язык и Telegram URL.
3. Добавьте провайдеров: хостинг, регистратор доменов, сервис сертификатов.
4. Создайте записи: серверы, домены или сертификаты.
5. Укажите сроки истечения с точностью до даты и времени.
6. Добавляйте платежи в USDT внутри записи.
7. Смотрите статистику, логи и ближайшие уведомления.

## Telegram-уведомления

SERVIX использует формат:

```text
tgram://TOKEN/CHAT_ID:TOPIC_ID
```

Где:

- `TOKEN` - токен Telegram-бота;
- `CHAT_ID` - ID чата или группы;
- `TOPIC_ID` - ID темы в группе, необязательная часть.

Периоды уведомлений задаются в настройках через запятую:

```text
5m,2h,5h,1d,3d,10d,15d
```

Поддерживаемые единицы:

- `m` - минуты;
- `h` - часы;
- `d` - дни.

Уведомления планируются автоматически. Если срок записи изменился, SERVIX выбирает ближайший подходящий период и не отправляет сразу все дальние уведомления. Неактивные записи уведомления не отправляют.

Кнопка теста Telegram находится в настройках рядом с полем `URL уведомлений` и проверяет именно тот URL, который сейчас введен в поле.

## Авторизация и 2FA

При первом запуске, если пользователя еще нет, открывается страница создания аккаунта.

После входа в настройках можно:

- сменить пароль;
- включить 2FA;
- отсканировать QR-код приложением-аутентификатором;
- отключить 2FA.

После смены пароля старые сессии сбрасываются.

## Данные и резервные копии

Основные файлы находятся в папке `data`:

```text
data/servix.sqlite
data/access.log
```

Рекомендуется регулярно делать резервную копию всей папки `data`.

Перед обновлением:

```bash
cp -r data data.backup
```

На Windows можно просто скопировать папку `data` вручную.

## Обновление

```bash
git pull
docker compose up -d --build
```

Если приложение запущено без Docker:

```bash
git pull
npm install
npm run build
npm start
```

## Caddy и HTTPS

Для внешнего доступа лучше использовать HTTPS через reverse proxy. Самый простой вариант - Caddy: он сам получает и обновляет TLS-сертификаты.

Если SERVIX работает за HTTPS reverse proxy, рекомендуется добавить:

```yaml
environment:
  COOKIE_SECURE: "true"
```

Также желательно ограничить доступ firewall или авторизацией на уровне reverse proxy.

### Вариант 1: Caddy установлен на сервере

Запустите SERVIX только на локальном порту:

```yaml
services:
  servix:
    build: .
    container_name: servix
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      SITE_TITLE: "SERVIX"
      DATA_DIR: "/app/data"
      APP_TIMEZONE: "Europe/Moscow"
      COOKIE_SECURE: "true"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Создайте Caddyfile:

```caddyfile
servix.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Перезапустите Caddy:

```bash
sudo systemctl reload caddy
```

После этого панель будет доступна по адресу:

```text
https://servix.example.com
```

### Вариант 2: SERVIX и Caddy в Docker Compose

```yaml
services:
  servix:
    build: .
    container_name: servix
    expose:
      - "3000"
    environment:
      SITE_TITLE: "SERVIX"
      DATA_DIR: "/app/data"
      APP_TIMEZONE: "Europe/Moscow"
      COOKIE_SECURE: "true"
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    container_name: servix-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - servix
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

`Caddyfile` рядом с `docker-compose.yml`:

```caddyfile
servix.example.com {
  reverse_proxy servix:3000
}
```

Запуск:

```bash
docker compose up -d --build
```

Перед запуском замените `servix.example.com` на свой домен и направьте DNS A/AAAA-запись на IP сервера.

## PWA

SERVIX можно установить как приложение из браузера:

- откройте панель в браузере;
- используйте пункт `Установить приложение` или `Add to Home screen`;
- после установки панель будет открываться отдельным окном.

## Что лучше не делать

- Не запускайте несколько контейнеров с одной и той же SQLite-базой одновременно.
- Не храните папку `data` во временной директории.
- Не публикуйте `TELEGRAM_NOTIFY_URL`, потому что в нем находится токен бота.
- Не открывайте панель в интернет без HTTPS.
- Не удаляйте записи, если нужна история платежей: лучше деактивируйте их.

## Структура проекта

```text
server.js              # Node.js backend, API, SQLite, Telegram, auth
src/                   # Vue frontend
src/views/             # страницы интерфейса
locale/                # ru/en переводы
public/                # manifest и публичные assets
data/                  # база и логи, создается при запуске
Dockerfile             # production-сборка
docker-compose.yml     # пример запуска
```

## Лицензия

MIT
