-- 🛡️ Migration: User Status Schema Recovery & Sync
-- 1. status 컬럼이 없는 경우 추가 (SQLite에서는 IF NOT EXISTS를 ALTER TABLE에 쓸 수 없으므로 에러 무시 또는 조건부 실행 필요)
-- wrangler d1 execute 시 개별 명령으로 처리하거나, 이미 존재하는 경우의 에러를 방지하기 위해 간단한 컬럼 추가를 시도합니다.
-- (현 로킹 환경에선 수동 추가 명령으로 대체하거나 아래 명령을 시도)

-- 2. 상태값 초기화 및 데이터 무결성 확보
-- 비밀번호가 있는 사용자는 ACTIVE, 없는 사용자는 PRE_REGISTERED로 설정
UPDATE users 
SET status = CASE 
    WHEN (password_hash IS NOT NULL AND password_hash != '') THEN 'ACTIVE'
    ELSE 'PRE_REGISTERED'
END
WHERE status IS NULL OR status = '';

-- 3. SUSPENDED 사용자의 is_active 일관성 확보
UPDATE users SET is_active = 0 WHERE status = 'SUSPENDED';
UPDATE users SET is_active = 1 WHERE status IN ('ACTIVE', 'PRE_REGISTERED');
