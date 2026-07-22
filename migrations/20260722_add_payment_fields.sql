-- Добавление поля cost (стоимость) в таблицу payments
ALTER TABLE payments ADD COLUMN cost REAL NOT NULL DEFAULT 0;

-- Добавление поля paid (оплачено) в таблицу payments
ALTER TABLE payments ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;

-- Добавление поля notifications_disabled (отключены уведомления) в таблицу payments
ALTER TABLE payments ADD COLUMN notifications_disabled INTEGER NOT NULL DEFAULT 0;
