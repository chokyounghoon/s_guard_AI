-- ============================================================================
-- S-GUARD AI & S-CALLERT: Cloudflare D1 Full Database Tuning & Index Optimization
-- Target: Cloudflare D1 (SQLite Engine)
-- Purpose: Eliminate Full Table Scans, drastically reduce Rows Read & latency
-- ============================================================================

-- 1. [S-Callert 발신 엔진] 통화 이력 및 대상자 튜닝 (Full Table Scan 제거)
CREATE INDEX IF NOT EXISTS IDX_HIST_EMP_LOG ON TB_SCL_CALL_HIST (EMP_ID, LOG_ID DESC);
CREATE INDEX IF NOT EXISTS IDX_HIST_STRAT_DT ON TB_SCL_CALL_HIST (STRATEGY_ID, CALL_DT DESC);
CREATE INDEX IF NOT EXISTS IDX_HIST_IGW_STRAT ON TB_SCL_CALL_HIST (IGW_TXN_ID, STRATEGY_ID);
CREATE INDEX IF NOT EXISTS IDX_TARGET_STRAT_SORT ON TB_SCL_TARGET_INFO (STRATEGY_ID, SORT_ORD ASC);
CREATE INDEX IF NOT EXISTS IDX_TEST_LOG_STRAT_LOG ON TB_SCL_TEST_LOG (STRATEGY_ID, LOG_ID DESC);

-- 2. [Web Push & FCM 알림] 수신자별 구독 조회 튜닝 (알림 발송 시 전체 스캔 방지)
CREATE INDEX IF NOT EXISTS IDX_PUSH_SUBS_USER ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS IDX_FCM_TOKENS_USER ON fcm_tokens (user_id);

-- 3. [SMS 수신 및 중복 체크] 실시간 SMS 수신 및 Deduplication 튜닝
CREATE INDEX IF NOT EXISTS IDX_RCV_MSG_HASH_TIME ON received_messages (msg_hash, timestamp DESC);
CREATE INDEX IF NOT EXISTS IDX_RCV_EMP_TIME ON received_messages (employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS IDX_RCV_READ ON received_messages (read);

-- 4. [인시던트 & 워룸] 워룸 참여자, 채팅, 상태 조회 튜닝
CREATE INDEX IF NOT EXISTS IDX_INC_ASSIGN_INC_STATUS ON incident_assignments (inc_id, status);
CREATE INDEX IF NOT EXISTS IDX_USER_WARROOMS_INC ON user_warrooms (inc_id);
CREATE INDEX IF NOT EXISTS IDX_WARROOM_STATUS_REGDT ON warroom_list (status, reg_dt DESC);
CREATE INDEX IF NOT EXISTS IDX_AICHAT_INC_ID ON aichat_history (inc_id, id ASC);
CREATE INDEX IF NOT EXISTS IDX_INCIDENTS_SOURCE_SMS ON incidents (source_sms_id);

-- 5. [사용자 & 인증] 대소문자 무관 로그인 및 세션/권한 조회 튜닝 (Expression Index)
CREATE INDEX IF NOT EXISTS IDX_USERS_UPPER_EMP ON users (UPPER(employee_id));
CREATE INDEX IF NOT EXISTS IDX_USERS_LOWER_EMAIL ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS IDX_USERS_ADMIN_ACTIVE ON users (is_admin, is_active);
CREATE INDEX IF NOT EXISTS IDX_USER_SESSIONS_TOKEN ON user_sessions (refresh_token);
CREATE INDEX IF NOT EXISTS IDX_USER_SESSIONS_USER ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS IDX_USER_CHAT_USER_TIME ON user_chat_sessions (user_id, updated_at DESC);

-- 6. [AI 리포트 & 인박스 & 활동 로그] 활동 로그 및 알림함 튜닝
CREATE INDEX IF NOT EXISTS IDX_ACTIVITY_INC_TYPE_STATUS ON activity_logs (inc_id, type, status);
CREATE INDEX IF NOT EXISTS IDX_INBOX_INC_TYPE ON inbox_items (inc_id, type);
CREATE INDEX IF NOT EXISTS IDX_SUBSTITUTES_USER_PRIORITY ON substitutes (user_id, priority ASC);
CREATE INDEX IF NOT EXISTS IDX_DM_SENDER_RECEIVER ON direct_messages (sender_id, receiver_id, created_at ASC);
CREATE INDEX IF NOT EXISTS IDX_DM_RECEIVER_SENDER ON direct_messages (receiver_id, sender_id, created_at ASC);

-- 7. [근태 & 출퇴근 관리] 도급/협력사 출근 실적 및 휴가 신청 튜닝
CREATE INDEX IF NOT EXISTS IDX_COMMUTE_DATE_TIME ON commute_logs (work_date, clock_in_time ASC);
CREATE INDEX IF NOT EXISTS IDX_COMMUTE_EMP_DATE ON commute_logs (employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS IDX_ATTENDANCE_EMP_TIME ON attendance_requests (employee_id, created_at DESC);
