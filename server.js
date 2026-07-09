import { createServer } from "node:http";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import https from "node:https";

process.env.TZ ||= process.env.APP_TIMEZONE || "Europe/Moscow";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SITE_TITLE = process.env.SITE_TITLE || "SERVIX";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "servix.sqlite");
const ACCESS_LOG_FILE = path.join(DATA_DIR, "access.log");
const LEGACY_JSON_FILE = path.join(DATA_DIR, "assets.json");
const PUBLIC_DIR = path.join(__dirname, "dist");
const LOCALE_DIR = path.join(__dirname, "locale");
const TELEGRAM_NOTIFY_URL = String(process.env.TELEGRAM_NOTIFY_URL || "");
const NOTIFY_ON_START = String(process.env.NOTIFY_ON_START || "true") === "true";
const APP_TIMEZONE = String(process.env.APP_TIMEZONE || "Europe/Moscow");
const MAX_TIMEOUT_MS = 2_147_483_647;
const SESSION_MAX_AGE_SECONDS = 2_592_000;
const AUTH_RATE_WINDOW_MS = 15 * 60_000;
const AUTH_RATE_MAX_ATTEMPTS = 8;
const TOTP_RATE_MAX_ATTEMPTS = 6;

const sessions = new Map();
const authAttempts = new Map();
let db;
let notificationTimer = null;
const locales = loadLocales();

const countryFlags = {
  "": "🌐", RU: "🇷🇺", DE: "🇩🇪", NL: "🇳🇱", FI: "🇮", FR: "🇫🇷", GB: "🇬", US: "🇺🇸", CA: "🇨🇦", PL: "🇵🇱", CZ: "🇿",
  SE: "🇪", NO: "🇳🇴", CH: "🇨🇭", AT: "🇦🇹", ES: "🇪🇸", IT: "🇮🇹", TR: "🇹🇷", AE: "🇪", KZ: "🇰🇿", UA: "🇺",
  BY: "🇧🇾", LT: "🇱", LV: "🇱🇻", EE: "🇪🇪", RO: "🇷🇴", BG: "🇬", MD: "🇲", GE: "🇬🇪", AM: "🇦🇲", AZ: "🇦🇿",
  SG: "🇸🇬", JP: "🇯🇵", KR: "🇷", HK: "🇭", IN: "🇮🇳", AU: "🇦🇺", BR: "🇧🇷", AR: "🇦🇷", MX: "🇲🇽", ZA: "🇦"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function loadLocales() {
  const result = {};
  for (const locale of ["ru", "en"]) {
    try {
      result[locale] = JSON.parse(readFileSync(path.join(LOCALE_DIR, `${locale}.json`), "utf8"));
    } catch (error) {
      console.warn(`Locale ${locale} skipped: ${error.message}`);
    }
  }
  return result;
}

function t(locale, key, params = {}) {
  const dictionary = locales[locale] || locales.ru || {};
  const fallback = locales.ru || {};
  const value = getPath(dictionary, key) ?? getPath(fallback, key) ?? key;
  return interpolate(value, params);
}

function tc(locale, key, count, params = {}) {
  const forms = getPath(locales[locale] || locales.ru || {}, `plural.${key}`) || getPath(locales.ru || {}, `plural.${key}`);
  if (!Array.isArray(forms)) return String(count);
  const index = pluralIndex(locale, count);
  return interpolate(forms[index] || forms[forms.length - 1], { ...params, count });
}

function getPath(object, pathValue) {
  return String(pathValue).split(".").reduce((value, part) => value?.[part], object);
}

function interpolate(value, params = {}) {
  return String(value).replace(/{(\w+)}/g, (_, key) => params[key] ?? "");
}

function pluralIndex(locale, count) {
  const value = Math.abs(Number(count));
  if (locale === "ru") {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  return value === 1 ? 0 : 1;
}

async function initDb() {
  await mkdir(DATA_DIR, { recursive: true });
  const existed = existsSync(DB_FILE);
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS providers ( id TEXT PRIMARY KEY, name TEXT NOT NULL, login_url TEXT NOT NULL DEFAULT '', favicon_url TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS assets ( id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, provider_id TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', domain TEXT NOT NULL DEFAULT '', country_code TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS payments ( id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, paid_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USDT', author_id TEXT NOT NULL DEFAULT '', FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE );
    CREATE TABLE IF NOT EXISTS telegram_sent ( event_id TEXT PRIMARY KEY, sent_at TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS currency_rates ( id INTEGER PRIMARY KEY AUTOINCREMENT, currency_code TEXT NOT NULL, rate REAL NOT NULL, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
    CREATE TABLE IF NOT EXISTS payment_authors ( id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
  `);

  ensureColumn("providers", "color", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("providers", "note", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("assets", "country_code", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("assets", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("assets", "inactive", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("users", "totp_secret", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("users", "totp_pending_secret", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("users", "totp_enabled", "INTEGER NOT NULL DEFAULT 0");

  ensureMeta("siteTitle", SITE_TITLE);
  ensureMeta("notificationLeads", "5m,2h,1d,3d,5d");
  ensureMeta("locale", "ru");
  ensureMeta("timezone", normalizeTimezone(APP_TIMEZONE));
  ensureMeta("telegramNotifyUrl", TELEGRAM_NOTIFY_URL);
  ensureMeta("notifyOnStart", String(NOTIFY_ON_START));
  ensureMeta("default_currency", "USDT");
  ensureMeta("enable_rub", "0");
  ensureMeta("auto_update_rates", "1");

  process.env.TZ = getMeta().timezone;
  if (!existed) await migrateLegacyJson();
  ensureProviderColors();
}

function ensureMeta(key, value) {
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)").run(key, String(value));
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function ensureProviderColors() {
  const rows = db.prepare("SELECT id, name, color FROM providers").all();
  const stmt = db.prepare("UPDATE providers SET color = ?, updated_at = ? WHERE id = ?");
  for (const row of rows) {
    if (!normalizeColor(row.color)) stmt.run(randomProviderColor(row.id || row.name), new Date().toISOString(), row.id);
  }
}

async function migrateLegacyJson() {
  if (!existsSync(LEGACY_JSON_FILE)) return;
  try {
    const legacy = JSON.parse(await readFile(LEGACY_JSON_FILE, "utf8"));
    if (legacy.meta?.siteTitle) setMeta("siteTitle", legacy.meta.siteTitle);
    if (legacy.meta?.notificationLeads) setMeta("notificationLeads", legacy.meta.notificationLeads);
    for (const provider of legacy.providers || []) upsertProvider(normalizeProvider(provider, provider));
    for (const asset of legacy.assets || []) upsertAsset(normalizeAsset(asset, asset));
  } catch (error) {
    console.warn(`Legacy JSON migration skipped: ${error.message}`);
  }
}

function getMeta() {
  const rows = db.prepare("SELECT key, value FROM meta").all();
  const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    siteTitle: meta.siteTitle || SITE_TITLE,
    notificationLeads: meta.notificationLeads || "5m,2h,1d,3d,5d",
    locale: locales[meta.locale] ? meta.locale : "ru",
    timezone: normalizeTimezone(meta.timezone || APP_TIMEZONE),
    telegramNotifyUrl: meta.telegramNotifyUrl || "",
    notifyOnStart: String(meta.notifyOnStart ?? "true") === "true",
    telegramConfigured: Boolean(meta.telegramNotifyUrl || TELEGRAM_NOTIFY_URL),
    default_currency: meta.default_currency || "USDT",
    enable_rub: meta.enable_rub === "1",
    auto_update_rates: meta.auto_update_rates === "1"
  };
}

function getPublicMeta() {
  const meta = getMeta();
  return {
    siteTitle: meta.siteTitle,
    locale: meta.locale,
    timezone: meta.timezone
  };
}

function setMeta(key, value) {
  db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

function normalizeTimezone(value) {
  const timezone = String(value || APP_TIMEZONE).trim() || APP_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new Error("Invalid timezone");
  }
}

function getData() {
  const providers = db.prepare(`SELECT id, name, login_url AS loginUrl, favicon_url AS faviconUrl, color, note, created_at AS createdAt, updated_at AS updatedAt FROM providers ORDER BY created_at DESC`).all();
  const assets = db.prepare(`SELECT id, type, name, provider_id AS providerId, expires_at AS expiresAt, ip, domain, country_code AS countryCode, sort_order AS sortOrder, inactive, created_at AS createdAt, updated_at AS updatedAt FROM assets ORDER BY type ASC, sort_order ASC, created_at DESC`).all();
  const payments = db.prepare(`SELECT id, asset_id AS assetId, amount, paid_at AS paidAt, note, created_at AS createdAt, currency, author_id AS authorId FROM payments ORDER BY paid_at DESC, created_at DESC`).all();
  for (const asset of assets) {
    asset.inactive = Boolean(asset.inactive);
    asset.payments = payments.filter((payment) => payment.assetId === asset.id).map(({ assetId, ...payment }) => payment);
  }
  return { meta: getMeta(), providers, assets };
}

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...extra
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, securityHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }));
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

async function logAction(req, action, details = {}, status = 200) {
  const entry = {
    at: new Date().toISOString(),
    action,
    method: req.method,
    path: req.url?.split("?")[0] || "",
    status,
    ip: clientIp(req),
    details
  };
  try {
    await appendFile(ACCESS_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.warn(`Access log write failed: ${error.message}`);
  }
}

async function readAccessLog() {
  try {
    const raw = await readFile(ACCESS_LOG_FILE, "utf8");
    return raw.trim().split("\n").filter(Boolean).slice(-1000).reverse().map((line, index) => {
      try {
        return { id: `${index}-${line.length}`, ...JSON.parse(line) };
      } catch {
        return { id: `broken-${index}`, at: "", action: "broken", method: "", path: "", status: 0, ip: "", details: { line } };
      }
    });
  } catch {
    return [];
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Слишком большой запрос"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Некорректный JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeAsset(input, previous = {}) {
  const now = new Date().toISOString();
  const type = ["vps", "domain", "certificate"].includes(input.type) ? input.type : "vps";
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Название обязательно");
  const base = {
    id: previous.id || input.id || crypto.randomUUID(),
    type,
    name,
    providerId: String(input.providerId || "").trim(),
    expiresAt: normalizeDateTime(input.expiresAt || ""),
    ip: type === "vps" ? String(input.ip || "").trim() : "",
    domain: type === "vps" ? "" : String(input.domain || name).trim(),
    countryCode: type === "vps" ? String(input.countryCode || previous.countryCode || "").trim().toUpperCase().slice(0, 2) : "",
    sortOrder: Number(input.sortOrder ?? previous.sortOrder ?? Date.now()),
    inactive: Boolean(input.inactive ?? previous.inactive ?? false),
    payments: normalizePayments(input.payments ?? previous.payments ?? []),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
  return base;
}

function normalizePayments(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((payment) => ({
      id: payment.id || crypto.randomUUID(),
      amount: Number(payment.amount || 0),
      paidAt: normalizeDateTime(payment.paidAt || "", { dateOnlyOk: true }),
      note: String(payment.note || "").trim(),
      currency: String(payment.currency || "USDT").trim(),
      authorId: String(payment.authorId || "").trim(),
      createdAt: payment.createdAt || new Date().toISOString()
    }))
    .filter((payment) => payment.amount > 0 || payment.paidAt || payment.note);
}

function normalizeDateTime(value, { dateOnlyOk = false } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return dateOnlyOk ? raw : `${raw}T00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  return raw;
}

function normalizeProvider(input, previous = {}) {
  const now = new Date().toISOString();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Название провайдера обязательно");
  const loginUrl = normalizeExternalUrl(input.loginUrl);
  const id = previous.id || input.id || crypto.randomUUID();
  return {
    id,
    name,
    loginUrl,
    faviconUrl: normalizeFaviconUrl(input.faviconUrl, loginUrl),
    color: normalizeColor(input.color) || normalizeColor(previous.color) || randomProviderColor(id),
    note: String(input.note ?? previous.note ?? "").trim(),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function normalizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function randomProviderColor(seed = crypto.randomUUID()) {
  const hash = crypto.createHash("sha256").update(String(seed)).digest();
  const hue = hash[0] % 360;
  const saturation = 58 + (hash[1] % 18);
  const lightness = 48 + (hash[2] % 12);
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function normalizeFaviconUrl(raw, loginUrl = "") {
  const value = normalizeExternalUrl(raw) || normalizeExternalUrl(loginUrl);
  if (!value) return "";
  try {
    const url = new URL(value);
    const ext = path.extname(url.pathname).toLowerCase();
    if (!ext || url.pathname === "/" || ![".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(ext)) {
      return `${url.origin}/favicon.ico`;
    }
    return url.toString();
  } catch {
    return "";
  }
}

function upsertAsset(asset) {
  db.prepare(`INSERT INTO assets (id, type, name, provider_id, expires_at, ip, domain, country_code, sort_order, inactive, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, name = excluded.name, provider_id = excluded.provider_id, expires_at = excluded.expires_at, ip = excluded.ip, domain = excluded.domain, country_code = excluded.country_code, sort_order = excluded.sort_order, inactive = excluded.inactive, updated_at = excluded.updated_at`)
    .run(asset.id, asset.type, asset.name, asset.providerId, asset.expiresAt, asset.ip, asset.domain, asset.countryCode, asset.sortOrder, asset.inactive ? 1 : 0, asset.createdAt, asset.updatedAt);
  db.prepare("DELETE FROM payments WHERE asset_id = ?").run(asset.id);
  const stmt = db.prepare("INSERT INTO payments (id, asset_id, amount, paid_at, note, created_at, currency, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const payment of asset.payments || []) {
    stmt.run(payment.id, asset.id, payment.amount, payment.paidAt, payment.note, payment.createdAt, payment.currency, payment.authorId);
  }
  scheduleNotifications();
  return asset;
}

function reorderAssets(type, ids, inactive = false) {
  const assetType = ["vps", "domain", "certificate"].includes(type) ? type : "";
  if (!assetType || !Array.isArray(ids)) throw new Error("Invalid reorder request");
  const inactiveValue = inactive ? 1 : 0;
  const existing = db.prepare("SELECT id FROM assets WHERE type = ? AND inactive = ?").all(assetType, inactiveValue).map((row) => row.id);
  const existingSet = new Set(existing);
  const orderedIds = ids.filter((id) => existingSet.has(id));
  if (orderedIds.length !== existing.length) throw new Error("Invalid assets order");
  const now = new Date().toISOString();
  const stmt = db.prepare("UPDATE assets SET sort_order = ?, updated_at = ? WHERE id = ? AND type = ? AND inactive = ?");
  orderedIds.forEach((id, index) => stmt.run(index, now, id, assetType, inactiveValue));
  return getData().assets.filter((asset) => asset.type === assetType && asset.inactive === Boolean(inactive));
}

function upsertProvider(provider) {
  db.prepare(`INSERT INTO providers (id, name, login_url, favicon_url, color, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, login_url = excluded.login_url, favicon_url = excluded.favicon_url, color = excluded.color, note = excluded.note, updated_at = excluded.updated_at`)
    .run(provider.id, provider.name, provider.loginUrl, provider.faviconUrl, provider.color, provider.note, provider.createdAt, provider.updatedAt);
  return provider;
}

function deleteAsset(id) {
  const asset = getData().assets.find((item) => item.id === id);
  if (!asset) return null;
  db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  scheduleNotifications();
  return asset;
}

function deleteProvider(id) {
  const provider = getData().providers.find((item) => item.id === id);
  if (!provider) return null;
  db.prepare("DELETE FROM providers WHERE id = ?").run(id);
  db.prepare("UPDATE assets SET provider_id = '' WHERE provider_id = ?").run(id);
  return provider;
}

function getDueItems(data = getData()) {
  const locale = data.meta?.locale || "ru";
  const maxLeadMinutes = Math.max(...getNotificationLeads(data.meta).map((lead) => lead.minutes), 1);
  const now = new Date();
  const limit = new Date(now.getTime() + maxLeadMinutes * 60_000);
  return data.assets
    .filter((asset) => !asset.inactive)
    .flatMap((asset) => {
      const value = parseAppDate(asset.expiresAt);
      if (!value || value > limit) return [];
      const minutesLeft = Math.ceil((value - now) / 60_000);
      return [{
        id: eventId(asset),
        assetId: asset.id,
        type: "expiresAt",
        date: asset.expiresAt,
        title: `${typeLabel(asset.type, locale)} ${t(locale, "common.expiresAt").toLowerCase()}: ${asset.name}`,
        daysLeft: Math.ceil(minutesLeft / 1440),
        minutesLeft
      }];
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function getNotificationEvents(data = getData()) {
  const leads = getNotificationLeads(data.meta);
  return data.assets
    .filter((asset) => !asset.inactive)
    .flatMap((asset) => {
      const expires = parseAppDate(asset.expiresAt);
      if (!expires) return [];
      return leads.map((lead) => ({
        id: eventId(asset, lead),
        asset,
        lead,
        expires,
        triggerAt: new Date(expires.getTime() - lead.minutes * 60_000)
      }));
    })
    .sort((a, b) => a.triggerAt - b.triggerAt);
}

function pickNearestDueEvents(events, now) {
  const byAsset = new Map();
  for (const event of events) {
    if (event.triggerAt > now || wasSent(event.id)) continue;
    const key = `${event.asset.id}-${event.asset.expiresAt}`;
    const current = byAsset.get(key);
    if (!current) {
      byAsset.set(key, { ...event, suppressIds: [event.id] });
      continue;
    }
    current.suppressIds.push(event.id);
    if (event.lead.minutes < current.lead.minutes) {
      byAsset.set(key, { ...event, suppressIds: current.suppressIds });
    }
  }
  return [...byAsset.values()].sort((a, b) => a.triggerAt - b.triggerAt);
}

function eventId(asset, lead = null) {
  return `${asset.id}-expiresAt-${asset.expiresAt}${lead ? `-${lead.value}` : ""}`;
}

function getNotificationLeads(meta = getMeta()) {
  const source = String(meta.notificationLeads || "5m,2h,1d,3d,5d");
  const parsed = source.split(",").map((item) => parseDurationToken(item.trim())).filter(Boolean);
  const unique = new Map(parsed.map((lead) => [lead.value, lead]));
  return [...unique.values()].sort((a, b) => a.minutes - b.minutes);
}

function normalizeNotificationLeads(value) {
  const leads = String(value || "").split(",").map((item) => parseDurationToken(item.trim())).filter(Boolean);
  if (!leads.length) return "5m,2h,1d,3d,5d";
  const unique = new Map(leads.map((lead) => [lead.value, lead]));
  return [...unique.values()].sort((a, b) => a.minutes - b.minutes).map((lead) => lead.value).join(",");
}

function parseDurationToken(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d+)\s*([mhd])$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!amount || amount < 1) return null;
  const unit = match[2];
  const multiplier = unit === "m" ? 1 : unit === "h" ? 60 : 1440;
  return { value: `${amount}${unit}`, amount, unit, minutes: amount * multiplier };
}

function parseAppDate(value) {
  if (!value) return null;
  const raw = String(value);
  const localValue = raw.includes("T") ? raw : `${raw}T00:00`;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function typeLabel(type, locale = "ru") {
  return t(locale, `type.${type}`) || t(locale, "type.record");
}

function userCount() {
  return db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 210_000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.password_salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.password_hash, "hex"));
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function currentUser(req) {
  const token = sessionToken(req);
  const session = token ? sessions.get(token) : null;
  return session?.userId ? getUserById(session.userId) : null;
}

function updatePassword(user, password) {
  if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters");
  const passwordData = hashPassword(password);
  db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?")
    .run(passwordData.hash, passwordData.salt, new Date().toISOString(), user.id);
  invalidateUserSessions(user.id);
}

function invalidateUserSessions(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) sessions.delete(token);
  }
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let current = 0;
  const bytes = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpCode(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const value = ((hmac[offset] & 127) << 24) | ((hmac[offset + 1] & 255) << 16) | ((hmac[offset + 2] & 255) << 8) | (hmac[offset + 3] & 255);
  return String(value % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret, token) {
  const clean = String(token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return false;
  const counter = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((offset) => crypto.timingSafeEqual(Buffer.from(totpCode(secret, counter + offset)), Buffer.from(clean)));
}

function totpUri(user, secret) {
  const issuer = getMeta().siteTitle || SITE_TITLE;
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.login)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function createUser(login, password) {
  const now = new Date().toISOString();
  const normalizedLogin = String(login || "").trim();
  if (!normalizedLogin) throw new Error("Login is required");
  if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters");
  const passwordData = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    login: normalizedLogin,
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    createdAt: now,
    updatedAt: now
  };
  db.prepare("INSERT INTO users (id, login, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(user.id, user.login, user.passwordHash, user.passwordSalt, user.createdAt, user.updatedAt);
  return user;
}

function authenticate(login, password) {
  const user = db.prepare("SELECT * FROM users WHERE login = ?").get(String(login || "").trim());
  if (!user) {
    hashPassword(password, "00000000000000000000000000000000");
    return null;
  }
  return user && verifyPassword(password, user) ? user : null;
}

function isSecureRequest(req) {
  return req.socket.encrypted || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" || String(process.env.COOKIE_SECURE || "") === "true";
}

function sessionCookie(req, token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function startSession(req, res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  res.writeHead(200, securityHeaders({
    "content-type": "application/json; charset=utf-8",
    "set-cookie": sessionCookie(req, token)
  }));
  return res.end(JSON.stringify({ ok: true }));
}

function sessionToken(req) {
  const cookie = req.headers.cookie || "";
  return cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("session="))?.slice(8) || "";
}

function isAuthed(req) {
  if (userCount() === 0) return false;
  const token = sessionToken(req);
  const session = token ? sessions.get(token) : null;
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return Boolean(getUserById(session.userId));
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  sendJson(res, 401, { error: "Auth required" });
  return false;
}

function rateLimitKey(req, scope, identifier = "") {
  return `${scope}:${clientIp(req)}:${String(identifier || "").trim().toLowerCase()}`;
}

function checkRateLimit(key, limit = AUTH_RATE_MAX_ATTEMPTS) {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    authAttempts.set(key, { count: 0, resetAt: now + AUTH_RATE_WINDOW_MS });
    return true;
  }
  return entry.count < limit;
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt <= now) authAttempts.set(key, { count: 1, resetAt: now + AUTH_RATE_WINDOW_MS });
  else entry.count += 1;
}

function clearAttempts(...keys) {
  keys.forEach((key) => authAttempts.delete(key));
}

function cleanupAuthState() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [key, attempt] of authAttempts.entries()) {
    if (attempt.resetAt <= now) authAttempts.delete(key);
  }
}

function parseTelegramUrl(raw) {
  if (!raw) return null;
  const match = raw.match(/^tgram:\/\/([^/]+)\/([^:]+)(?::(.+))?$/);
  if (!match) throw new Error("TELEGRAM_NOTIFY_URL должен быть вида tgram://token/chat_id:topic");
  return { token: match[1], chatId: match[2], topicId: match[3] || "" };
}

function telegramNotifyUrl() {
  if (!db) return TELEGRAM_NOTIFY_URL;
  return getMeta().telegramNotifyUrl || "";
}

function notifyOnStart() {
  if (!db) return NOTIFY_ON_START;
  return String(getMeta().notifyOnStart ?? "true") === "true";
}

async function sendTelegramMessage(text, options = {}) {
  const config = parseTelegramUrl(options.notifyUrl ?? telegramNotifyUrl());
  if (!config) return { skipped: true, reason: "Telegram URL не задан" };
  const payload = { chat_id: config.chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (config.topicId) payload.message_thread_id = Number(config.topicId);
  if (options.buttonUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: options.buttonText || "Перейти к оплате", url: options.buttonUrl }]]
    };
  }
  const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.description || "Telegram не принял сообщение");
  return result;
}

function alertText(item, locale = "ru") {
  const when = item.minutesLeft < 0
    ? t(locale, "duration.overdueLower", { duration: formatDuration(Math.abs(item.minutesLeft), locale) })
    : item.minutesLeft === 0
      ? t(locale, "common.now")
      : t(locale, "duration.in", { duration: formatDuration(item.minutesLeft, locale) });
  const asset = item.asset;
  const provider = item.provider;
  const target = asset.type === "vps" ? asset.ip : asset.domain;
  const paid = totalPayments(asset.payments);
  const country = asset.type === "vps" && asset.countryCode ? countryLabel(asset.countryCode, locale) : "";
  const lines = [
    t(locale, "telegram.title"),
    "",
    `<b>${escapeTelegram(typeLabel(asset.type, locale))}:</b> ${escapeTelegram(asset.name)}`,
    provider ? `<b>${escapeTelegram(t(locale, "telegram.provider"))}:</b> ${escapeTelegram(provider.name)}` : `<b>${escapeTelegram(t(locale, "telegram.provider"))}:</b> ${escapeTelegram(t(locale, "common.providerEmpty"))}`,
    target ? `<b>${asset.type === "vps" ? "IP" : escapeTelegram(t(locale, "common.domain"))}:</b> ${escapeTelegram(target)}` : "",
    country ? `<b>${escapeTelegram(t(locale, "common.country"))}:</b> ${escapeTelegram(country)}` : "",
    `<b>${escapeTelegram(t(locale, "telegram.expiresAt"))}:</b> ${escapeTelegram(formatDateTime(asset.expiresAt, locale))}`,
    `<b>${escapeTelegram(t(locale, "telegram.left"))}:</b> ${escapeTelegram(when)}`,
    item.lead ? `<b>${escapeTelegram(t(locale, "telegram.trigger"))}:</b> ${escapeTelegram(t(locale, "telegram.triggerBefore", { lead: formatLead(item.lead, locale) }))}` : "",
    `<b>${escapeTelegram(t(locale, "telegram.paidTotal"))}:</b> ${escapeTelegram(formatUsdt(paid, locale))}`
  ].filter(Boolean);
  return lines.join("\n");
}

function escapeTelegram(value) {
  return String(value).replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char]);
}

function countryLabel(code, locale = "ru") {
  const countryCode = String(code || "").toUpperCase();
  const flag = countryFlags[countryCode] || countryFlags[""];
  const name = t(locale, `countries.${countryCode}`) || t(locale, "common.countryEmpty");
  return countryCode ? `${flag} ${name}` : name;
}

function formatDateTime(value, locale = "ru") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: getMeta().timezone }).format(parseAppDate(value));
}

function formatDuration(minutes, locale = "ru") {
  const total = Math.max(0, Number(minutes || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return `${tc(locale, "day", days)} ${tc(locale, "hour", hours)}`;
  if (hours) return `${tc(locale, "hour", hours)} ${tc(locale, "minute", mins)}`;
  return tc(locale, "minute", mins);
}

function formatLead(lead, locale = "ru") {
  if (!lead) return "";
  const key = lead.unit === "m" ? "minute" : lead.unit === "h" ? "hour" : "day";
  return tc(locale, key, lead.amount);
}

function formatUsdt(value, locale = "ru") {
  return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 6 }).format(Number(value || 0))} USDT`;
}

function totalPayments(payments = []) {
  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function wasSent(eventIdValue) {
  return Boolean(db.prepare("SELECT event_id FROM telegram_sent WHERE event_id = ?").get(eventIdValue));
}

function markSent(eventIdValue) {
  db.prepare("INSERT OR REPLACE INTO telegram_sent (event_id, sent_at) VALUES (?, ?)").run(eventIdValue, new Date().toISOString());
}

async function processDueNotifications() {
  if (!telegramNotifyUrl()) return scheduleNotifications();
  const now = new Date();
  const data = getData();
  const locale = data.meta.locale || "ru";
  const providerById = new Map(data.providers.map((provider) => [provider.id, provider]));
  const due = pickNearestDueEvents(getNotificationEvents(data), now)
    .map((event) => {
      const minutesLeft = Math.ceil((event.expires - now) / 60_000);
      return {
        id: event.id,
        assetId: event.asset.id,
        asset: event.asset,
        provider: providerById.get(event.asset.providerId),
        date: event.asset.expiresAt,
        title: `${typeLabel(event.asset.type, locale)} ${t(locale, "common.expiresAt").toLowerCase()}: ${event.asset.name}`,
        lead: event.lead,
        suppressIds: event.suppressIds,
        minutesLeft,
        daysLeft: Math.ceil(minutesLeft / 1440)
      };
    });
  if (due.length) {
    for (const item of due) {
      const result = await sendTelegramMessage(alertText(item, locale), {
        buttonUrl: item.provider?.loginUrl,
        buttonText: t(locale, "telegram.paymentButton")
      });
      if (!result?.skipped) {
        for (const id of item.suppressIds || [item.id]) markSent(id);
      }
    }
  }
  scheduleNotifications();
}

function scheduleNotifications() {
  if (notificationTimer) clearTimeout(notificationTimer);
  if (!telegramNotifyUrl()) return;
  const now = new Date();
  const next = getNotificationEvents().find((event) => !wasSent(event.id));
  if (!next) return;
  const delay = Math.max(0, Math.min(MAX_TIMEOUT_MS, next.triggerAt - now));
  notificationTimer = setTimeout(() => processDueNotifications().catch((error) => {
    console.warn(error.message);
    scheduleNotifications();
  }), delay);
}

// === ФУНКЦИИ ДЛЯ КУРСОВ ВАЛЮТ ===
function fetchCBRRate() {
  return new Promise((resolve, reject) => {
    https.get("https://www.cbr.ru/scripts/XML_daily.asp", (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const usdMatch = data.match(/<Valute ID="R01235">[\s\S]*?<Value>([\d,\s]+)<\/Value>/);
          const eurMatch = data.match(/<Valute ID="R01239">[\s\S]*?<Value>([\d,\s]+)<\/Value>/);
          const result = {};
          if (usdMatch) result.USD = parseFloat(usdMatch[1].replace(",", ".").replace(/\s/g, ""));
          if (eurMatch) result.EUR = parseFloat(eurMatch[1].replace(",", ".").replace(/\s/g, ""));
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function getCurrentRates() {
  const usd = db.prepare("SELECT rate FROM currency_rates WHERE currency_code = 'USD' ORDER BY date DESC LIMIT 1").get();
  const eur = db.prepare("SELECT rate FROM currency_rates WHERE currency_code = 'EUR' ORDER BY date DESC LIMIT 1").get();
  return { USD: usd?.rate || null, EUR: eur?.rate || null };
}

function saveCurrencyRates(rates) {
  const now = new Date().toISOString();
  for (const [currency, rate] of Object.entries(rates)) {
    db.prepare("INSERT INTO currency_rates (currency_code, rate, date, created_at) VALUES (?, ?, ?, ?)").run(currency, rate, now, now);
  }
}

function getPaymentAuthors() {
  return db.prepare("SELECT * FROM payment_authors WHERE is_active = 1 ORDER BY sort_order, name").all();
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/auth/status") {
    return sendJson(res, 200, { setupRequired: userCount() === 0, authenticated: isAuthed(req), meta: getPublicMeta() });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/setup") {
    if (userCount() > 0) return sendJson(res, 409, { error: "User already exists" });
    const body = await readBody(req);
    if (String(body.password || "") !== String(body.passwordRepeat || "")) return sendJson(res, 400, { error: "Passwords do not match" });
    const user = createUser(body.login, body.password);
    await logAction(req, "auth.setup", { login: String(body.login || "").trim() });
    return startSession(req, res, user);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const loginKey = rateLimitKey(req, "login", body.login);
    const ipKey = rateLimitKey(req, "login-ip");
    if (!checkRateLimit(loginKey) || !checkRateLimit(ipKey, AUTH_RATE_MAX_ATTEMPTS * 2)) {
      await logAction(req, "auth.login.rate_limited", { login: String(body.login || "").trim() }, 429);
      return sendJson(res, 429, { error: "Too many login attempts" });
    }
    const user = authenticate(body.login, body.password);
    if (user) {
      if (Number(user.totp_enabled || 0) && !verifyTotp(user.totp_secret, body.token)) {
        const totpKey = rateLimitKey(req, "2fa", user.login);
        if (!checkRateLimit(totpKey, TOTP_RATE_MAX_ATTEMPTS)) {
          await logAction(req, "auth.login.2fa_rate_limited", { login: user.login }, 429);
          return sendJson(res, 429, { error: "Too many 2FA attempts" });
        }
        if (!body.token) return sendJson(res, 200, { requiresTotp: true });
        recordFailedAttempt(totpKey);
        await logAction(req, "auth.login.2fa_failed", { login: user.login }, 403);
        return sendJson(res, 403, { error: "Invalid 2FA code" });
      }
      clearAttempts(loginKey, ipKey, rateLimitKey(req, "2fa", user.login));
      await logAction(req, "auth.login", { login: user.login });
      return startSession(req, res, user);
    }
    recordFailedAttempt(loginKey);
    recordFailedAttempt(ipKey);
    await logAction(req, "auth.login.failed", { login: String(body.login || "").trim() }, 403);
    return sendJson(res, 403, { error: "Invalid login or password" });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = sessionToken(req);
    if (token) sessions.delete(token);
    await logAction(req, "auth.logout");
    res.writeHead(200, securityHeaders({
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(req, "", 0)
    }));
    return res.end(JSON.stringify({ ok: true }));
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "GET" && url.pathname === "/api/auth/security") {
    const user = currentUser(req);
    return sendJson(res, 200, { login: user.login, totpEnabled: Boolean(Number(user.totp_enabled || 0)), hasPendingTotp: Boolean(user.totp_pending_secret) });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/password") {
    const user = currentUser(req);
    const body = await readBody(req);
    if (!verifyPassword(body.currentPassword, user)) return sendJson(res, 403, { error: "Invalid current password" });
    if (String(body.newPassword || "") !== String(body.passwordRepeat || "")) return sendJson(res, 400, { error: "Passwords do not match" });
    updatePassword(user, body.newPassword);
    await logAction(req, "auth.password");
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/2fa/setup") {
    const user = currentUser(req);
    const body = await readBody(req);
    if (!verifyPassword(body.currentPassword, user)) return sendJson(res, 403, { error: "Invalid current password" });
    const secret = generateTotpSecret();
    db.prepare("UPDATE users SET totp_pending_secret = ?, updated_at = ? WHERE id = ?").run(secret, new Date().toISOString(), user.id);
    await logAction(req, "auth.2fa.setup");
    return sendJson(res, 200, { secret, otpauthUrl: totpUri(user, secret) });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/2fa/enable") {
    const user = currentUser(req);
    const body = await readBody(req);
    if (!verifyPassword(body.currentPassword, user)) return sendJson(res, 403, { error: "Invalid current password" });
    const secret = user.totp_pending_secret || "";
    if (!secret) return sendJson(res, 400, { error: "2FA setup is not started" });
    if (!verifyTotp(secret, body.token)) return sendJson(res, 403, { error: "Invalid 2FA code" });
    db.prepare("UPDATE users SET totp_secret = ?, totp_pending_secret = '', totp_enabled = 1, updated_at = ? WHERE id = ?").run(secret, new Date().toISOString(), user.id);
    await logAction(req, "auth.2fa.enable");
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/2fa/disable") {
    const user = currentUser(req);
    const body = await readBody(req);
    if (!verifyPassword(body.currentPassword, user)) return sendJson(res, 403, { error: "Invalid current password" });
    if (Number(user.totp_enabled || 0) && !verifyTotp(user.totp_secret, body.token)) return sendJson(res, 403, { error: "Invalid 2FA code" });
    db.prepare("UPDATE users SET totp_secret = '', totp_pending_secret = '', totp_enabled = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
    await logAction(req, "auth.2fa.disable");
    return sendJson(res, 200, { ok: true });
  }

  // === ВАЛЮТЫ ===
  if (req.method === "GET" && url.pathname === "/api/currency/rates") {
    try {
      const rates = await fetchCBRRate();
      saveCurrencyRates(rates);
      return sendJson(res, 200, { success: true, rates });
    } catch (error) {
      return sendJson(res, 500, { success: false, error: error.message });
    }
  }
  if (req.method === "GET" && url.pathname === "/api/currency/current") {
    return sendJson(res, 200, { success: true, rates: getCurrentRates() });
  }

  // === АВТОРЫ ПЛАТЕЖЕЙ ===
  if (req.method === "GET" && url.pathname === "/api/payment-authors") {
    return sendJson(res, 200, { success: true, authors: getPaymentAuthors() });
  }
  if (req.method === "POST" && url.pathname === "/api/payment-authors") {
    try {
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      if (!name) return sendJson(res, 400, { error: "Имя обязательно" });
      const maxOrder = db.prepare("SELECT MAX(sort_order) as max FROM payment_authors").get()?.max || 0;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare("INSERT INTO payment_authors (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)").run(id, name, maxOrder + 1, now);
      const author = db.prepare("SELECT * FROM payment_authors WHERE id = ?").get(id);
      await logAction(req, "payment_author.create", { id: author.id, name: author.name });
      return sendJson(res, 201, { success: true, author });
    } catch (error) {
      return sendJson(res, 500, { success: false, error: error.message });
    }
  }

  const authorMatch = url.pathname.match(/^\/api\/payment-authors\/([^/]+)$/);
  if (authorMatch) {
    const id = authorMatch[1];
    const existing = db.prepare("SELECT * FROM payment_authors WHERE id = ?").get(id);
    if (!existing) return sendJson(res, 404, { error: "Автор не найден" });

    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        const name = String(body.name || "").trim();
        if (!name) return sendJson(res, 400, { error: "Имя обязательно" });
        db.prepare("UPDATE payment_authors SET name = ?, sort_order = ? WHERE id = ?").run(name, Number(body.sort_order || 0), id);
        await logAction(req, "payment_author.update", { id, name });
        return sendJson(res, 200, { success: true });
      } catch (error) {
        return sendJson(res, 500, { success: false, error: error.message });
      }
    }

    if (req.method === "DELETE") {
      try {
        const hasPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE author_id = ?").get(id);
        if (hasPayments?.count > 0) {
          return sendJson(res, 400, { success: false, error: "Нельзя удалить автора, у которого есть платежи" });
        }
        db.prepare("UPDATE payment_authors SET is_active = 0 WHERE id = ?").run(id);
        await logAction(req, "payment_author.delete", { id });
        return sendJson(res, 200, { success: true });
      } catch (error) {
        return sendJson(res, 500, { success: false, error: error.message });
      }
    }
  }

  // === НАСТРОЙКИ ВАЛЮТ ===
  const currencySettingMatch = url.pathname.match(/^\/api\/settings\/(default_currency|enable_rub|auto_update_rates)$/);
  if (currencySettingMatch && req.method === "POST") {
    try {
      const key = currencySettingMatch[1];
      const body = await readBody(req);
      setMeta(key, String(body.value ?? ""));
      await logAction(req, "settings.currency", { key, value: body.value });
      return sendJson(res, 200, { success: true });
    } catch (error) {
      return sendJson(res, 500, { success: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/assets") return sendJson(res, 200, getData());
  if (req.method === "GET" && url.pathname === "/api/logs") return sendJson(res, 200, { items: await readAccessLog() });
  if (req.method === "GET" && url.pathname === "/api/notifications") return sendJson(res, 200, { items: getDueItems() });
  if (req.method === "POST" && url.pathname === "/api/telegram/test") {
    const body = await readBody(req);
    const locale = getMeta().locale || "ru";
    const notifyUrl = Object.hasOwn(body, "telegramNotifyUrl") ? String(body.telegramNotifyUrl || "").trim() : undefined;
    const result = await sendTelegramMessage(t(locale, "alerts.testMessage"), { notifyUrl });
    return sendJson(res, 200, { ok: true, skipped: Boolean(result?.skipped), reason: result?.reason || "" });
  }
  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    setMeta("siteTitle", String(body.siteTitle || SITE_TITLE).trim());
    setMeta("notificationLeads", normalizeNotificationLeads(body.notificationLeads));
    setMeta("locale", locales[body.locale] ? body.locale : "ru");
    setMeta("timezone", normalizeTimezone(body.timezone));
    setMeta("telegramNotifyUrl", String(body.telegramNotifyUrl || "").trim());
    setMeta("notifyOnStart", String(Boolean(body.notifyOnStart)));
    process.env.TZ = getMeta().timezone;
    scheduleNotifications();
    await logAction(req, "settings.update", { locale: body.locale, timezone: body.timezone, telegramConfigured: Boolean(body.telegramNotifyUrl) });
    return sendJson(res, 200, getMeta());
  }
  if (req.method === "POST" && url.pathname === "/api/assets") {
    const asset = upsertAsset(normalizeAsset(await readBody(req)));
    await logAction(req, "asset.create", { id: asset.id, type: asset.type, name: asset.name });
    return sendJson(res, 201, asset);
  }
  if (req.method === "POST" && url.pathname === "/api/assets/reorder") {
    const body = await readBody(req);
    await logAction(req, "asset.reorder", { type: body.type, count: Array.isArray(body.ids) ? body.ids.length : 0 });
    return sendJson(res, 200, { assets: reorderAssets(body.type, body.ids, Boolean(body.inactive)) });
  }
  const assetMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch) {
    const existing = getData().assets.find((asset) => asset.id === assetMatch[1]);
    if (!existing) return sendJson(res, 404, { error: "Запись не найдена" });
    if (req.method === "PUT") {
      const asset = upsertAsset(normalizeAsset(await readBody(req), existing));
      await logAction(req, "asset.update", { id: asset.id, type: asset.type, name: asset.name });
      return sendJson(res, 200, asset);
    }
    if (req.method === "DELETE") {
      const asset = deleteAsset(existing.id);
      await logAction(req, "asset.delete", { id: existing.id, type: existing.type, name: existing.name });
      return sendJson(res, 200, asset);
    }
  }
  if (req.method === "POST" && url.pathname === "/api/providers") {
    const provider = upsertProvider(normalizeProvider(await readBody(req)));
    await logAction(req, "provider.create", { id: provider.id, name: provider.name });
    return sendJson(res, 201, provider);
  }
  const providerMatch = url.pathname.match(/^\/api\/providers\/([^/]+)$/);
  if (providerMatch) {
    const existing = getData().providers.find((provider) => provider.id === providerMatch[1]);
    if (!existing) return sendJson(res, 404, { error: "Провайдер не найден" });
    if (req.method === "PUT") {
      const provider = upsertProvider(normalizeProvider(await readBody(req), existing));
      await logAction(req, "provider.update", { id: provider.id, name: provider.name });
      return sendJson(res, 200, provider);
    }
    if (req.method === "DELETE") {
      const provider = deleteProvider(existing.id);
      await logAction(req, "provider.delete", { id: existing.id, name: provider.name });
      return sendJson(res, 200, provider);
    }
  }
  return sendJson(res, 404, { error: "API endpoint не найден" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const publicRoot = path.resolve(PUBLIC_DIR);
  const filePath = path.resolve(publicRoot, requested.replace(/^\/+/, ""));
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
    res.writeHead(403, securityHeaders({ "content-type": "text/plain; charset=utf-8" }));
    return res.end("Forbidden");
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not found");
    res.writeHead(200, securityHeaders({ "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" }));
    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.destroyed) res.destroy();
    });
    stream.pipe(res);
  } catch {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    try {
      await stat(indexPath);
      res.writeHead(200, securityHeaders({ "content-type": "text/html; charset=utf-8" }));
      const stream = createReadStream(indexPath);
      stream.on("error", () => {
        if (!res.destroyed) res.destroy();
      });
      stream.pipe(res);
    } catch {
      res.writeHead(404, securityHeaders({ "content-type": "text/plain; charset=utf-8" }));
      res.end("Не найдено. Выполните npm run build.");
    }
  }
}

await initDb();
setInterval(cleanupAuthState, 60 * 60_000).unref();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Ошибка запроса" });
  }
});

server.listen(PORT, () => {
  console.log(`${SITE_TITLE}: http://localhost:${PORT}`);
  console.log("Login/password authorization is enabled");
  if (telegramNotifyUrl()) console.log("Realtime Telegram notifications are configured");
  if (telegramNotifyUrl() && notifyOnStart()) {
    processDueNotifications().catch((error) => console.warn(error.message));
  } else {
    scheduleNotifications();
  }
});