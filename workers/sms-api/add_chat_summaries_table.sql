-- Create chat_summaries table for persistent caching of AI reports
CREATE TABLE IF NOT EXISTS chat_summaries (
    inc_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    model TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inc_id) REFERENCES warroom_list(inc_id)
);
