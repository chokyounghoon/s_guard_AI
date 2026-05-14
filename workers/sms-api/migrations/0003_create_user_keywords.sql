-- Migration to create user_keywords table
CREATE TABLE IF NOT EXISTS user_keywords (
  user_id TEXT PRIMARY KEY,
  keywords TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
