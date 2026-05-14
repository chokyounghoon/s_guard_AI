-- 대직자 관리 (Deputy/Substitute Management) 테이블 설계
-- Run: wrangler d1 execute sguard-db --remote --file=migrate_substitutes.sql

CREATE TABLE IF NOT EXISTS substitutes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,               -- 대상자 사번 (users.employee_id)
    deputy_id   TEXT    NOT NULL,               -- 대직자 사번 (users.employee_id)
    priority    INTEGER NOT NULL DEFAULT 1,      -- 대직 순위 (1, 2, 3...)
    is_active   INTEGER NOT NULL DEFAULT 1,      -- 활성화 여부
    reg_id      TEXT    DEFAULT 'SYSTEM',
    reg_dt      DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id      TEXT    DEFAULT 'SYSTEM',
    mod_dt      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, deputy_id),                 -- 동일인 중복 지정 방지
    FOREIGN KEY(user_id)   REFERENCES users(employee_id),
    FOREIGN KEY(deputy_id) REFERENCES users(employee_id)
);

-- 인덱스: 대상자별 대직자 조회 최적화
CREATE INDEX IF NOT EXISTS idx_sub_user_id ON substitutes(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_priority ON substitutes(priority);
