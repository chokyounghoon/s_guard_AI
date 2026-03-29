-- Migrate source_sms_id to TEXT in incidents table
CREATE TABLE incidents_new (
    inc_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'NORMAL',
    status TEXT DEFAULT 'Open',
    incident_type TEXT DEFAULT 'AI',
    assigned_to TEXT,
    source_sms_id TEXT,
    ai_insight TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO incidents_new SELECT inc_id, title, description, severity, status, incident_type, assigned_to, CAST(source_sms_id AS TEXT), ai_insight, created_at, updated_at, reg_id, reg_dt, mod_id, mod_dt FROM incidents;
DROP TABLE incidents;
ALTER TABLE incidents_new RENAME TO incidents;
