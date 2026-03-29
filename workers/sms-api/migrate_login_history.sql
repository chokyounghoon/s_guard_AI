-- Migrate login_history.user_id to TEXT to store Employee IDs (사번)
-- 1. Create temporary table
CREATE TABLE login_history_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, -- Changed from INTEGER to TEXT
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Migrate existing data
INSERT INTO login_history_temp (
    id, user_id, email, ip_address, user_agent, status, login_time, reg_id, reg_dt, mod_id, mod_dt
)
SELECT 
    id, CAST(user_id AS TEXT), email, ip_address, user_agent, status, login_time, reg_id, reg_dt, mod_id, mod_dt
FROM login_history;

-- 3. Drop old table and rename new one
DROP TABLE login_history;
ALTER TABLE login_history_temp RENAME TO login_history;

-- 4. Re-add indices if any (optional, but good practice)
CREATE INDEX idx_login_history_user_id ON login_history(user_id);
