-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE,
    first_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы серий (огоньков)
CREATE TABLE IF NOT EXISTS streaks (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id),
    user2_id INTEGER REFERENCES users(id),
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    restore_count INTEGER DEFAULT 0,
    restore_month INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

-- Создание таблицы сообщений
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    streak_id INTEGER REFERENCES streaks(id),
    sender_id INTEGER REFERENCES users(id),
    message_text TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_streaks_users ON streaks(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_streak ON messages(streak_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);