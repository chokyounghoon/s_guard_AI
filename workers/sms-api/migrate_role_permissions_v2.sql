-- role_permissions 테이블 재설계 마이그레이션
-- Run: wrangler d1 execute sguard-db --remote --file=migrate_role_permissions_v2.sql

-- 기존 테이블 삭제 후 재생성 (데이터는 권한관리 화면에서 재설정)
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE IF NOT EXISTS role_permissions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    role_code  TEXT    NOT NULL,
    menu_id    INTEGER NOT NULL,
    menu_name  TEXT    NOT NULL DEFAULT '',
    menu_path  TEXT    NOT NULL DEFAULT '',
    can_read   INTEGER NOT NULL DEFAULT 0,
    can_write  INTEGER NOT NULL DEFAULT 0,
    can_delete INTEGER NOT NULL DEFAULT 0,
    reg_id     TEXT    DEFAULT 'SYSTEM',
    reg_dt     DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id     TEXT    DEFAULT 'SYSTEM',
    mod_dt     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_code, menu_id),
    FOREIGN KEY(role_code) REFERENCES roles(role_code),
    FOREIGN KEY(menu_id)   REFERENCES menus(id)
);

-- 인덱스: 역할별 권한 조회 최적화
CREATE INDEX IF NOT EXISTS idx_rp_role_code ON role_permissions(role_code);
CREATE INDEX IF NOT EXISTS idx_rp_menu_id   ON role_permissions(menu_id);
