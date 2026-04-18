-- AI 피드백 수집용 테이블 생성
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,         -- 피드백을 준 사용자 사번
    inc_id TEXT,                  -- 관련 장애 ID (있는 경우)
    query TEXT NOT NULL,           -- 사용자의 원본 질문
    answer TEXT NOT NULL,          -- AI가 생성한 답변
    context TEXT,                  -- RAG에 사용된 지식 정보 (Chunks)
    feedback_type TEXT NOT NULL,   -- 'UP' (좋아요) 또는 'DOWN' (싫어요)
    reason TEXT,                   -- 'DOWN'일 경우 선택한 사유
    user_correction TEXT,          -- 사용자가 직접 입력한 정답/교정 내용
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'PENDING',        -- PENDING, APPROVED, REJECTED
    is_golden INTEGER DEFAULT 0,          -- 1: 골든 데이터셋, 0: 일반
    admin_comment TEXT,                   -- 관리자 검토 의견
    error_category TEXT,                  -- 장애 카테고리 (분석 통계용)
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);

-- 검색 성능을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_inc_id ON ai_feedback(inc_id);
