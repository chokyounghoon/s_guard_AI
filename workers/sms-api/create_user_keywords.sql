CREATE TABLE IF NOT EXISTS user_keywords (
    user_id TEXT PRIMARY KEY,
    keywords TEXT NOT NULL, -- "ABEND|장애|오류" 형태로 저장
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
