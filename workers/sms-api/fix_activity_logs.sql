CREATE TABLE activity_logs_fix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inc_id TEXT,
    user_id TEXT,
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

INSERT INTO activity_logs_fix (
    inc_id, user_id, user_name, incident_code, incident_title, 
    action, detail, team, report_type, created_at, 
    reg_id, reg_dt, mod_id, mod_dt
)
SELECT 
    inc_id, user_id, user_name, incident_code, incident_title, 
    action, detail, team, report_type, created_at, 
    reg_id, reg_dt, mod_id, mod_dt
FROM activity_logs;

DROP TABLE activity_logs;
ALTER TABLE activity_logs_fix RENAME TO activity_logs;
