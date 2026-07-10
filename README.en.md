# SERVIX

[Русский](README.md) | [English](README.en.md)

SERVIX is a self-hosted panel for tracking servers, domains, certificates, providers, payments, and service expiration dates.

The project runs on Node.js, SQLite, and Vue. Data is stored locally in the `data` directory, notifications are sent to Telegram, and the interface can be installed as a PWA from the browser.

## Features

- server, domain, and certificate tracking;
- separate fields for each record type;
- providers with panel URL, favicon, color, and notes;
- USDT payments for each record;
- server payment statistics by period and provider;
- searchable, sortable, paginated tables with export;
- Telegram notifications with leads such as `5m`, `2h`, `1d`, `3d`, `5d`;
- realtime notification scheduling without constant hourly polling;
- login and password authentication;
- optional 2FA with an authenticator app;
- action log stored in `data/access.log`;
- dark responsive interface;
- Russian and English interface through i18n;
- browser installation through `manifest.webmanifest`.

## Requirements

For Docker deployment:

- Docker;
- Docker Compose.

For local deployment without Docker:

- Node.js `24+`;
- npm.

## Quick Docker Start

```bash
git clone https://github.com/sansepro/servix.git
cd servix
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

On the first visit, SERVIX shows the user creation screen. Enter a login, password, and password confirmation.

## Example docker-compose.yml

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

If you do not use Telegram topics:

```yaml
TELEGRAM_NOTIFY_URL: "tgram://TOKEN/CHAT_ID"
```

## Environment Variables

- `PLATEGA_MERCHANT_ID` — your Platega Merchant ID.
- `PLATEGA_SECRET` — your Platega secret key.

You can also configure these values from the app admin settings.


| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port inside the container or local Node.js process. |
| `SITE_TITLE` | `SERVIX` | Initial panel title. It can be changed later in settings. |
| `DATA_DIR` | `./data` | Directory with the SQLite database and logs. |
| `APP_TIMEZONE` | `Europe/Moscow` | Initial application timezone. It can be changed later in settings. |
| `TELEGRAM_NOTIFY_URL` | empty | Initial Telegram notification URL. It can be changed later in settings. |
| `NOTIFY_ON_START` | `true` | Send relevant upcoming notifications after application startup. |
| `COOKIE_SECURE` | empty | Set to `true` when the app is served behind an HTTPS reverse proxy. |

`SITE_TITLE`, `APP_TIMEZONE`, `TELEGRAM_NOTIFY_URL`, and `NOTIFY_ON_START` are stored in the database. After the first launch, it is usually easier to manage them from the settings page.

## Local Run Without Docker

```bash
git clone https://github.com/sansepro/servix.git
cd servix
npm install
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

For frontend development:

```bash
npm run dev
```

## How to Use

1. Create an account on the first launch.
2. Open settings and check timezone, language, and Telegram URL.
3. Add providers: hosting panels, domain registrars, certificate services.
4. Create records: servers, domains, or certificates.
5. Set expiration dates with date and time precision.
6. Add USDT payments inside records.
7. Review statistics, logs, and upcoming notifications.

## Telegram Notifications

SERVIX uses this format:

```text
tgram://TOKEN/CHAT_ID:TOPIC_ID
```

Where:

- `TOKEN` is the Telegram bot token;
- `CHAT_ID` is the chat or group ID;
- `TOPIC_ID` is an optional forum topic ID.

Notification leads are configured in settings as a comma-separated list:

```text
5m,2h,5h,1d,3d,10d,15d
```

Supported units:

- `m` - minutes;
- `h` - hours;
- `d` - days.

Notifications are scheduled automatically. If a record expiration date changes, SERVIX chooses the nearest relevant lead and does not immediately send every farther lead. Inactive records do not send notifications.

The Telegram test button is located in settings near the `Notification URL` field and checks the URL currently typed in that field.

## Authentication and 2FA

On the first launch, if no user exists yet, the account creation page is shown.

In settings you can:

- change the password;
- enable 2FA;
- scan a QR code with an authenticator app;
- disable 2FA.

Old sessions are reset after a password change.

## Data and Backups

Main files are stored in the `data` directory:

```text
data/servix.sqlite
data/access.log
```

Back up the entire `data` directory regularly.

Before updating:

```bash
cp -r data data.backup
```

On Windows, you can simply copy the `data` directory manually.

## Updating

```bash
git pull
docker compose up -d --build
```

If the app runs without Docker:

```bash
git pull
npm install
npm run build
npm start
```

## Caddy and HTTPS

For external access, use HTTPS through a reverse proxy. Caddy is the simplest option because it obtains and renews TLS certificates automatically.

When SERVIX runs behind an HTTPS reverse proxy, it is recommended to add:

```yaml
environment:
  COOKIE_SECURE: "true"
```

It is also recommended to restrict access with a firewall or reverse proxy authentication.

### Option 1: Caddy Installed on the Server

Run SERVIX only on a local port:

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

Create a Caddyfile:

```caddyfile
servix.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

The panel will be available at:

```text
https://servix.example.com
```

### Option 2: SERVIX and Caddy in Docker Compose

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

`Caddyfile` next to `docker-compose.yml`:

```caddyfile
servix.example.com {
  reverse_proxy servix:3000
}
```

Start:

```bash
docker compose up -d --build
```

Before starting, replace `servix.example.com` with your domain and point the DNS A/AAAA record to your server IP.

## PWA

SERVIX can be installed from the browser:

- open the panel in a browser;
- use `Install app` or `Add to Home screen`;
- after installation, the panel opens in its own app window.

## What to Avoid

- Do not run multiple containers against the same SQLite database at the same time.
- Do not store the `data` directory in a temporary location.
- Do not publish `TELEGRAM_NOTIFY_URL`, because it contains the bot token.
- Do not expose the panel to the internet without HTTPS.
- Do not delete records if you need payment history: deactivate them instead.

## Project Structure

```text
server.js              # Node.js backend, API, SQLite, Telegram, auth
src/                   # Vue frontend
src/views/             # interface pages
locale/                # ru/en translations
public/                # manifest and public assets
data/                  # database and logs, created on startup
Dockerfile             # production build
docker-compose.yml     # example deployment
```

## License

MIT
