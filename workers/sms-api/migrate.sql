DELETE FROM knowledge_base;
DELETE FROM action_results;
DELETE FROM aichat_history;
DELETE FROM autopilot_insight;
DELETE FROM warroom_chats;
DELETE FROM warroom_attachments;
DELETE FROM warroom_list;
DELETE FROM incident_history;
DELETE FROM incidents;
DELETE FROM received_messages;

CREATE TABLE incidents_new (
    inc_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'NORMAL',
    status TEXT DEFAULT 'Open',
    incident_type TEXT DEFAULT 'AI',
    assigned_to TEXT,
    source_sms_id INTEGER,
    ai_insight TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
DROP TABLE incidents;
ALTER TABLE incidents_new RENAME TO incidents;
