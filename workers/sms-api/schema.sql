CREATE TABLE IF NOT EXISTS users (
    employee_id TEXT PRIMARY KEY,
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
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('PRE_REGISTERED', 'ACTIVE', 'SUSPENDED')),
    failed_attempts INTEGER DEFAULT 0,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    position TEXT DEFAULT 'POS_001',
    profile_picture TEXT
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
    parent_seq INTEGER,
    reactions TEXT,
    read_count INTEGER DEFAULT 0,
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
    similarity_score REAL,
    similarity_reason TEXT,
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
    UNIQUE(inc_id),
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
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_analyzing INTEGER DEFAULT 0,
    analyzer_name TEXT DEFAULT ''
);
-- Incident Assignments and Status
CREATE TABLE IF NOT EXISTS incident_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    inc_id TEXT NOT NULL,
    status TEXT DEFAULT '미확인', -- '미확인', '처리중', '처리완료'
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
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

-- Direct Messaging (Notes)
CREATE TABLE IF NOT EXISTS direct_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT,
    receiver_id TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(employee_id),
    FOREIGN KEY(receiver_id) REFERENCES users(employee_id)
);

-- AI Chat Sessions
CREATE TABLE IF NOT EXISTS user_chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    messages TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Report Hierarchy Matrix
CREATE TABLE IF NOT EXISTS report_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    hierarchy_level INTEGER NOT NULL,
    role_name TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME
);

CREATE INDEX IF NOT EXISTS idx_report_lines_owner ON report_lines(owner_id);

-- Support for RAG Upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_inc_id ON knowledge_base(inc_id);
-- Inbox Management
CREATE TABLE IF NOT EXISTS inbox_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,         -- Recipient employee_id
    type TEXT NOT NULL,            -- 'MESSAGE', 'REPORT', 'SYSTEM'
    sender_id TEXT,                -- Sender employee_id (optional)
    sender_name TEXT,              -- Sender display name
    title TEXT NOT NULL,           -- Message subject
    content TEXT,                  -- Detailed content
    preview TEXT,                  -- Short summary for list view
    is_read INTEGER DEFAULT 0,     -- Read status (0: unread, 1: read)
    urgency TEXT DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'HIGH', 'CRITICAL'
    inc_id TEXT,                   -- Associated incident ID (optional)
    folder TEXT DEFAULT 'INBOX',   -- 'INBOX' or 'SENT'
    action_link TEXT,              -- URL/Route for navigation (optional)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);

-- System Code Book
CREATE TABLE IF NOT EXISTS code_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    description TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, code)
);

-- Seed Code Book for System Roles
INSERT OR IGNORE INTO code_book (category, code, name, sort_order, description) VALUES 
('SYSTEM_ROLE', 'SUPER_ADMIN', '슈퍼 관리자', 0, '시스템 전체 제어 및 역할 관리 최고 권한'),
('SYSTEM_ROLE', 'ADMIN', '시스템 관리자', 1, '모든 기능에 대한 전체 권한'),
('SYSTEM_ROLE', 'ANALYST', '분석가', 2, '데이터 분석 및 보고서 작성 권한'),
('SYSTEM_ROLE', 'VIEWER', '조회자', 3, '단순 데이터 조회 및 모니터링 권한');

-- RBAC (Role Based Access Control) System
CREATE TABLE IF NOT EXISTS roles (
    role_code TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    description TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    icon TEXT,
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES menus(id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- 단일 PK (자동증가)
    role_code  TEXT    NOT NULL,                   -- 역할 코드 (roles.role_code 참조)
    menu_id    INTEGER NOT NULL,                   -- 소스 메뉴 ID (menus.id 참조)
    menu_name  TEXT    NOT NULL DEFAULT '',        -- 메뉴명 (비정규화 - 조회 편의용)
    menu_path  TEXT    NOT NULL DEFAULT '',        -- 메뉴 경로 (비정규화 - 경로 비교용)
    can_read   INTEGER NOT NULL DEFAULT 0,         -- 화면 접근(조회) 권한
    can_write  INTEGER NOT NULL DEFAULT 0,         -- 생성/수정 권한
    can_delete INTEGER NOT NULL DEFAULT 0,         -- 삭제 권한
    reg_id     TEXT    DEFAULT 'SYSTEM',
    reg_dt     DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id     TEXT    DEFAULT 'SYSTEM',
    mod_dt     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_code, menu_id),                    -- 역할+메뉴 조합 유일성 보장
    FOREIGN KEY(role_code) REFERENCES roles(role_code),
    FOREIGN KEY(menu_id)   REFERENCES menus(id)
);

-- Seed initial data for RBAC (Using codes from Code Book)
INSERT OR IGNORE INTO roles (role_code, role_name, description) VALUES ('SUPER_ADMIN', '슈퍼 관리자', '시스템 전체 제어 및 역할 관리 최고 권한');
INSERT OR IGNORE INTO roles (role_code, role_name, description) VALUES ('ADMIN', '시스템 관리자', '모든 기능에 대한 전체 권한');
INSERT OR IGNORE INTO roles (role_code, role_name, description) VALUES ('ANALYST', '분석가', '데이터 분석 및 보고서 작성 권한');
INSERT OR IGNORE INTO roles (role_code, role_name, description) VALUES ('VIEWER', '조회자', '단순 데이터 조회 및 모니터링 권한');

-- Initial Menu Structure
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('대시보드', '/dashboard', 'LayoutDashboard', 1);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('실시간 모니터링', '/monitor', 'Activity', 2);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('인시던트 관리', '/inbox', 'Inbox', 3);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('AI 리포트', '/ai-reports', 'FileText', 4);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('조직 관리', '/admin/org', 'Users', 5);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('사용자 관리', '/admin/users', 'UserCog', 6);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('권한 관리', '/admin/permissions', 'ShieldCheck', 7);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('지식 베이스', '/knowledge-base', 'Database', 8);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('코드북 관리', '/admin/codebook', 'Code', 9);
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES ('시스템 로그', '/admin/logs', 'History', 10);

