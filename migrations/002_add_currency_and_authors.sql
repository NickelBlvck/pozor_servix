-- Миграция для добавления мультивалютности и авторов платежей

-- Таблица для хранения курсов валют
CREATE TABLE IF NOT EXISTS currency_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_code TEXT NOT NULL, -- 'USD', 'EUR' и т.д.
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица авторов платежей
CREATE TABLE IF NOT EXISTS payment_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем поля в таблицу платежей
ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'USDT';
ALTER TABLE payments ADD COLUMN author_id INTEGER REFERENCES payment_authors(id);

-- Добавляем настройки по умолчанию
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_currency', 'USDT');
INSERT OR IGNORE INTO settings (key, value) VALUES ('enable_rub', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_update_rates', '1');

-- Добавляем начальных авторов (примеры)
INSERT INTO payment_authors (name, sort_order) VALUES 
    ('Администратор', 1),
    ('Бухгалтер', 2),
    ('Менеджер', 3);