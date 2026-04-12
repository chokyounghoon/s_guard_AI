-- Add Incident Handling Status Codes
INSERT INTO code_book (category, code, name, sort_order, is_active, description, reg_id, reg_dt, mod_id, mod_dt) 
VALUES 
('INCIDENT_STATUS', 'INC_001', '미처리', 10, 1, '장애 처리 대기 중', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('INCIDENT_STATUS', 'INC_002', '처리중', 20, 1, '장애 처리 및 분석 진행 중', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('INCIDENT_STATUS', 'INC_003', '처리완료', 30, 1, '장애 처리 완료 및 종료', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now'));

-- Add WarRoom (WR) Handling Status Codes
INSERT INTO code_book (category, code, name, sort_order, is_active, description, reg_id, reg_dt, mod_id, mod_dt) 
VALUES 
('WR_STATUS', 'WR_001', '개설완료', 10, 1, 'War-Room 실시간 채널 개설 완료', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('WR_STATUS', 'WR_002', '분석중(채팅중)', 20, 1, '실시간 대화 및 분석 진행 중', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('WR_STATUS', 'WR_003', '대화분석완료', 30, 1, '대화 내용 요약 및 분석 완료', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('WR_STATUS', 'WR_004', '보고서작성완료', 40, 1, 'AI 분석 리포트 생성 및 발행 완료', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now')),
('WR_STATUS', 'WR_005', '최종처리완료', 50, 1, '인시던트 최종 클로징 및 처리 완료', 'SYSTEM', datetime('now'), 'SYSTEM', datetime('now'));
