-- ============================================================
-- S-callert: 장애 자동 호출 알림 시스템 DDL
-- Target DB : Cloudflare D1 (SQLite compatible)
-- ============================================================

-- 1. 전략 마스터 (Rule Setting)
CREATE TABLE IF NOT EXISTS TB_SCL_STRATEGY_MST (
  STRATEGY_ID    TEXT    PRIMARY KEY,          -- 전략 ID (e.g. STR-001)
  STRATEGY_NM    TEXT    NOT NULL,             -- 전략명
  APPLY_START_DT TEXT    NOT NULL,             -- 적용시작일 (YYYYMMDD)
  APPLY_END_DT   TEXT    NOT NULL,             -- 종료일     (YYYYMMDD)
  MAX_CALL_CNT   INTEGER NOT NULL DEFAULT 3,   -- 최대 발신 횟수
  USE_YN         TEXT    NOT NULL DEFAULT 'Y'  -- 사용여부 (Y/N)
    CHECK (USE_YN IN ('Y','N')),
  -- Audit
  REG_ID         TEXT    NOT NULL DEFAULT 'SYSTEM',
  REG_DT         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  MOD_ID         TEXT,
  MOD_DT         TEXT
);

-- 2. 장애 담당자 정보 (Target Management)
CREATE TABLE IF NOT EXISTS TB_SCL_TARGET_INFO (
  SEQ_NO       INTEGER PRIMARY KEY AUTOINCREMENT,  -- 일련번호
  STRATEGY_ID  TEXT    NOT NULL REFERENCES TB_SCL_STRATEGY_MST(STRATEGY_ID) ON DELETE CASCADE,
  EMP_ID       TEXT    NOT NULL,                   -- 사번
  EMP_NM       TEXT    NOT NULL,                   -- 성명
  MOBILE_NO    TEXT    NOT NULL,                   -- 휴대번호 (010-XXXX-XXXX)
  SORT_ORD     INTEGER NOT NULL DEFAULT 0,         -- 발신 우선순위
  -- Audit
  REG_ID       TEXT    NOT NULL DEFAULT 'SYSTEM',
  REG_DT       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  MOD_ID       TEXT,
  MOD_DT       TEXT
);
CREATE INDEX IF NOT EXISTS IDX_TARGET_STRATEGY ON TB_SCL_TARGET_INFO(STRATEGY_ID);

-- 3. 발신 이력 (Real-time Flow)
CREATE TABLE IF NOT EXISTS TB_SCL_CALL_HIST (
  LOG_ID        INTEGER PRIMARY KEY AUTOINCREMENT,  -- 로그 ID
  STRATEGY_ID   TEXT    NOT NULL,                   -- 전략 ID
  EMP_ID        TEXT    NOT NULL,                   -- 사번
  ATTEMPT_SEQ   INTEGER NOT NULL DEFAULT 1,         -- 시도 회차
  IGW_TXN_ID    TEXT,                               -- IGW 트랜잭션 ID
  PDS_RESULT_CD TEXT,                               -- PDS 결과코드 (SUCCESS/FAIL/BUSY/NOANSWER)
  CALL_DT       TEXT    NOT NULL DEFAULT (datetime('now','localtime')), -- 발신일시
  INC_ID        TEXT,                               -- 연계 인시던트 ID (S-GUARD)
  RAW_PAYLOAD   TEXT,                               -- IGW 원문 JSON
  -- Audit
  REG_ID        TEXT    NOT NULL DEFAULT 'SYSTEM',
  REG_DT        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  MOD_ID        TEXT,
  MOD_DT        TEXT
);
CREATE INDEX IF NOT EXISTS IDX_HIST_STRATEGY ON TB_SCL_CALL_HIST(STRATEGY_ID);
CREATE INDEX IF NOT EXISTS IDX_HIST_CALL_DT  ON TB_SCL_CALL_HIST(CALL_DT DESC);

-- 샘플 초기 데이터
INSERT OR IGNORE INTO TB_SCL_STRATEGY_MST
  (STRATEGY_ID, STRATEGY_NM, APPLY_START_DT, APPLY_END_DT, MAX_CALL_CNT, USE_YN, REG_ID)
VALUES
  ('STR-001', 'IT인프라 장애 1차 대응팀', '20250101', '20251231', 3, 'Y', 'admin'),
  ('STR-002', 'DB 장애 전문 대응팀',       '20250101', '20251231', 5, 'Y', 'admin');
