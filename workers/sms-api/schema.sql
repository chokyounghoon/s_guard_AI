CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    auth_provider TEXT DEFAULT 'local',
    company TEXT,
    phone TEXT,
    honbu TEXT,
    team TEXT,
    part TEXT,
    subpart TEXT,
    token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    position TEXT DEFAULT 'POS_001'
);

CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    parent_id INTEGER,
    depth INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
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
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inc_id, user_id, created_at)
);

CREATE TABLE IF NOT EXISTS incidents (
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

CREATE TABLE IF NOT EXISTS incident_history (
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

CREATE TABLE IF NOT EXISTS action_results (
    inc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER,
    resolution_text TEXT,
    commandsUsed TEXT,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS received_messages (
    inc_id TEXT PRIMARY KEY,
    sender TEXT,
    message TEXT,
    employee_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    keyword_detected BOOLEAN DEFAULT 0,
    response_message TEXT,
    read BOOLEAN DEFAULT 0,
    received_count INTEGER DEFAULT 1,
    channel TEXT,
    if_id TEXT,
    service_code TEXT,
    service_name TEXT,
    biz_system TEXT,
    error_code TEXT,
    occurrence_count INTEGER,
    occurrence_node TEXT,
    error_message TEXT,
    occurrence_time DATETIME,
    receiver_1 TEXT, receiver_2 TEXT, receiver_3 TEXT, receiver_4 TEXT, receiver_5 TEXT,
    receiver_6 TEXT, receiver_7 TEXT, receiver_8 TEXT, receiver_9 TEXT, receiver_10 TEXT,
    receiver_11 TEXT, receiver_12 TEXT, receiver_13 TEXT, receiver_14 TEXT, receiver_15 TEXT,
    receiver_16 TEXT, receiver_17 TEXT, receiver_18 TEXT, receiver_19 TEXT, receiver_20 TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_history (
    inc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_keywords (
    inc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE,
    response TEXT,
    severity TEXT DEFAULT 'NORMAL',
    hit_count INTEGER DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warroom_chats (
    inc_id TEXT,
    seq INTEGER,
    sender TEXT,
    role TEXT,
    type TEXT DEFAULT 'user',
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inc_id, seq)
);

CREATE TABLE IF NOT EXISTS warroom_attachments (
    inc_id TEXT,
    seq INTEGER,
    filename TEXT,
    original_name TEXT,
    file_type TEXT,
    url TEXT,
    uploaded_by TEXT DEFAULT 'Unknown',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inc_id, seq)
);

CREATE TABLE IF NOT EXISTS reset_verifications (
    inc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aichat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inc_id TEXT NOT NULL,
    agent_role TEXT,
    content TEXT NOT NULL,
    reg_id TEXT,
    reg_dt DATETIME,
    mod_id TEXT,
    mod_dt DATETIME
);

CREATE TABLE IF NOT EXISTS autopilot_insight (
    inc_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    severity TEXT,
    category TEXT,
    reg_id TEXT,
    reg_dt DATETIME,
    mod_id TEXT,
    mod_dt DATETIME
);

CREATE TABLE IF NOT EXISTS postmortems (
    inc_id INTEGER PRIMARY KEY,
    incident_code TEXT UNIQUE,
    who TEXT,
    when_occurred DATETIME,
    where_occurred TEXT,
    what_happened TEXT,
    why_happened TEXT,
    how_resolved TEXT,
    report_text TEXT,
    is_confirmed BOOLEAN,
    created_at DATETIME,
    reg_id TEXT,
    reg_dt DATETIME,
    mod_id TEXT,
    mod_dt DATETIME,
    FOREIGN KEY(incident_code) REFERENCES incidents(inc_id)
);
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inc_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    file_url TEXT,
    file_type TEXT,
    tags TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt CURRENT_TIMESTAMP,
    vector F32_ARRAY(768),
    FOREIGN KEY (inc_id) REFERENCES received_messages(inc_id)
);

-- War-Room Tracking List
CREATE TABLE IF NOT EXISTS warroom_list (
    inc_id TEXT PRIMARY KEY,
    title TEXT,
    creator_id TEXT,
    status TEXT DEFAULT 'OPEN',
    severity TEXT,
    leader_summary TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Incident Assignments and Status
CREATE TABLE IF NOT EXISTS incident_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    inc_id TEXT NOT NULL,
    status TEXT DEFAULT '미확인', -- '미확인', '처리중', '처리완료'
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, inc_id),
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);

-- Personal War-Room Lists (Leave/Invite)
CREATE TABLE IF NOT EXISTS user_warrooms (
    user_id TEXT NOT NULL,
    inc_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, inc_id),
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);
