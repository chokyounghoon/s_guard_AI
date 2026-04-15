-- 🛡️ Database Cleanup: User Table Schema Refinement (employee_id as PK)
PRAGMA foreign_keys = OFF;

-- 1. 임시 테이블 생성 (최적화된 스키마 적용)
CREATE TABLE IF NOT EXISTS users_new (
    employee_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT, -- NULL 허용 (인사정보 선등록 대응)
    role TEXT DEFAULT 'user',
    auth_provider TEXT DEFAULT 'local',
    company TEXT,
    phone TEXT,
    honbu TEXT,
    team TEXT,
    part TEXT,
    subpart TEXT,
    token TEXT,
    status TEXT DEFAULT 'PRE_REGISTERED' CHECK (status IN ('PRE_REGISTERED', 'ACTIVE', 'SUSPENDED')),
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

-- 2. 기존 데이터 이관
-- 기존 테이블에서 필요한 컬럼만 추출하여 복사
INSERT INTO users_new (
    employee_id, email, name, password_hash, role, company, 
    phone, honbu, team, part, subpart, token, status, 
    failed_attempts, last_login_at, created_at, is_active, 
    is_admin, reg_id, reg_dt, mod_id, mod_dt, position, profile_picture
)
SELECT 
    employee_id, email, name, password_hash, role, company, 
    phone, honbu, team, part, subpart, token, status, 
    failed_attempts, last_login_at, created_at, is_active, 
    is_admin, reg_id, reg_dt, mod_id, mod_dt, position, profile_picture
FROM users;

-- 3. 교체 작업
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 4. 인덱스 재구성 및 외래 키 재활성화
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

PRAGMA foreign_keys = ON;
