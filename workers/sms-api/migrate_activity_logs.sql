-- 1. Create temporary table for activity_logs with TEXT for user_id
CREATE TABLE activity_logs_temp (
    inc_id TEXT PRIMARY KEY,
    user_id TEXT, -- Changed from INTEGER
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

-- 2. Migrate existing data, resolving employee_id from users table
-- We join on the old user_id (PK) to get the employee_id
INSERT INTO activity_logs_temp (
    inc_id, user_id, user_name, incident_code, incident_title, 
    action, detail, team, report_type, created_at, 
    reg_id, reg_dt, mod_id, mod_dt
)
SELECT 
    l.inc_id, 
    u.employee_id, -- Store 사번 instead of PK
    l.user_name, 
    l.inc_id, -- Set incident_code to inc_id as requested
    l.incident_title, 
    l.action, 
    l.detail, 
    l.team, 
    l.report_type, 
    l.created_at, 
    l.reg_id, 
    l.reg_dt, 
    l.mod_id, 
    l.mod_dt
FROM activity_logs l
LEFT JOIN users u ON l.user_id = u.id;

-- 3. Replace old table
DROP TABLE activity_logs;
ALTER TABLE activity_logs_temp RENAME TO activity_logs;

-- 4. Verify (Optional check in D1)
-- SELECT * FROM activity_logs LIMIT 5;
