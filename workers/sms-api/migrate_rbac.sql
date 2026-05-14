-- RBAC Migration: roles, menus, role_permissions + code_book
-- Run: wrangler d1 execute sguard-db --remote --file=migrate_rbac.sql

-- code_book table
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

-- roles table
CREATE TABLE IF NOT EXISTS roles (
    role_code TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    description TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- menus table
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
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_code TEXT NOT NULL,
    menu_id INTEGER NOT NULL,
    can_read INTEGER DEFAULT 1,
    can_write INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, menu_id)
);

-- Seed: SYSTEM_ROLE codebook
INSERT OR IGNORE INTO code_book (category, code, name, sort_order, description) VALUES
('SYSTEM_ROLE', 'SUPER_ADMIN', '슈퍼 관리자', 0, '시스템 전체 제어 및 역할 관리 최고 권한'),
('SYSTEM_ROLE', 'ADMIN',       '시스템 관리자', 1, '모든 기능에 대한 전체 권한'),
('SYSTEM_ROLE', 'ANALYST',     '분석가', 2, '데이터 분석 및 보고서 작성 권한'),
('SYSTEM_ROLE', 'VIEWER',      '조회자', 3, '단순 데이터 조회 및 모니터링 권한');

-- Seed: roles
INSERT OR IGNORE INTO roles (role_code, role_name, description) VALUES
('SUPER_ADMIN', '슈퍼 관리자', '시스템 전체 제어 및 역할 관리 최고 권한'),
('ADMIN',       '시스템 관리자', '모든 기능에 대한 전체 권한'),
('ANALYST',     '분석가', '데이터 분석 및 보고서 작성 권한'),
('VIEWER',      '조회자', '단순 데이터 조회 및 모니터링 권한');

-- Seed: menus (S-Guard 화면 목록)
INSERT OR IGNORE INTO menus (name, path, icon, sort_order) VALUES
('대시보드',       '/dashboard',               'LayoutDashboard', 1),
('실시간 모니터링', '/alert-monitor',           'Activity',        2),
('인시던트 수신',   '/incident-push',           'Inbox',           3),
('AI 리포트',      '/ai-report',               'FileText',        4),
('WAR-ROOM',      '/chat',                    'MessageSquare',   5),
('내 할당업무',    '/my-assignments',           'CheckCircle',     6),
('검색',          '/search',                  'Search',          7),
('지식 베이스',    '/knowledge-base',           'Database',        8),
('키워드 관리',    '/incident-keyword',         'Hash',            9),
('내 키워드',      '/user-keyword',             'Star',            10),
('사용자 관리',    '/user-management',          'UserCog',         11),
('조직 관리',      '/organization-management',  'Users',           12),
('권한 관리',      '/admin/permissions',        'ShieldCheck',     13),
('코드북 관리',    '/codebook-management',      'Code',            14),
('보안 로그',      '/security-logs',            'History',         15),
('S-callert',     '/s-callert',               'Phone',           16);
