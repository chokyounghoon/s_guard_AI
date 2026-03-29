-- 1. Migrate received_messages
CREATE TABLE received_messages_new (
    inc_id TEXT PRIMARY KEY,
    sender TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    keyword_detected BOOLEAN DEFAULT 0,
    response_message TEXT,
    read BOOLEAN DEFAULT 0,
    received_count INTEGER DEFAULT 1,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO received_messages_new SELECT CAST(inc_id AS TEXT), sender, message, timestamp, keyword_detected, response_message, "read", received_count, reg_id, reg_dt, mod_id, mod_dt FROM received_messages;
DROP TABLE received_messages;
ALTER TABLE received_messages_new RENAME TO received_messages;

-- 2. Migrate incident_history
CREATE TABLE incident_history_new (
    inc_id TEXT PRIMARY KEY,
    sms_id INTEGER,
    target_system TEXT,
    error_code TEXT,
    problem_description TEXT,
    severity TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO incident_history_new SELECT CAST(inc_id AS TEXT), sms_id, target_system, error_code, problem_description, severity, created_at, reg_id, reg_dt, mod_id, mod_dt FROM incident_history;
DROP TABLE incident_history;
ALTER TABLE incident_history_new RENAME TO incident_history;

-- 3. Migrate activity_logs
CREATE TABLE activity_logs_new (
    inc_id TEXT PRIMARY KEY,
    user_id INTEGER,
    user_name TEXT DEFAULT 'System',
    incident_code TEXT,
    incident_title TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    team TEXT,
    report_type TEXT DEFAULT 'AI 리포트',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO activity_logs_new SELECT CAST(inc_id AS TEXT), user_id, user_name, incident_code, incident_title, action, detail, team, report_type, created_at, reg_id, reg_dt, mod_id, mod_dt FROM activity_logs;
DROP TABLE activity_logs;
ALTER TABLE activity_logs_new RENAME TO activity_logs;
