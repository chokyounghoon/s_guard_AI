-- 누락된 대시보드/모바일 메뉴 화면들을 menus 및 role_permissions 테이블에 추가하는 시드 스크립트
INSERT OR IGNORE INTO menus (id, name, path, icon, sort_order) VALUES
(17, 'Orbital Command', '/orbital-command', 'Cpu', 17),
(18, '보고라인 관리', '/report-line-management', 'Users', 18),
(19, '종합 상황판', '/overall-status', 'Activity', 19),
(20, '워룸 허브', '/warroom-management', 'Shield', 20),
(21, '데이터 흐름', '/processing-flow', 'Layers', 21),
(22, '푸시 진단', '/push-diagnostic', 'Bell', 22),
(23, '리포트 검색', '/mobile-report-search', 'Search', 23),
(24, '대직자 관리', '/admin/deputy', 'UserCircle', 24),
(25, '활동 내역', '/activity', 'Activity', 25),
(26, 'AI 처리 리포트', '/ai-process-report', 'FileText', 26),
(27, '리포트 발행', '/report-publish', 'FileText', 27),
(28, '인시던트 목록', '/incident-list', 'Inbox', 28),
(29, '통합 키워드', '/keyword-management', 'Hash', 29);

-- 기본 권한 부여: SUPER_ADMIN, ADMIN은 모든 권한 부여
INSERT OR IGNORE INTO role_permissions (role_code, menu_id, menu_name, menu_path, can_read, can_write, can_delete)
SELECT 'SUPER_ADMIN', id, name, path, 1, 1, 1 FROM menus WHERE id >= 17;

INSERT OR IGNORE INTO role_permissions (role_code, menu_id, menu_name, menu_path, can_read, can_write, can_delete)
SELECT 'ADMIN', id, name, path, 1, 1, 1 FROM menus WHERE id >= 17;

-- ANALYST (분석가): 데이터 흐름, 대직자 관리 등 관리자 전용을 제외하고 일반 기능 허용
INSERT OR IGNORE INTO role_permissions (role_code, menu_id, menu_name, menu_path, can_read, can_write, can_delete)
SELECT 'ANALYST', id, name, path, 
  CASE WHEN path IN ('/processing-flow', '/admin/deputy') THEN 0 ELSE 1 END,
  CASE WHEN path IN ('/processing-flow', '/admin/deputy') THEN 0 ELSE 1 END,
  0
FROM menus WHERE id >= 17;

-- VIEWER (조회자): 조회 관련 화면만 허용 (can_write=0, can_delete=0)
INSERT OR IGNORE INTO role_permissions (role_code, menu_id, menu_name, menu_path, can_read, can_write, can_delete)
SELECT 'VIEWER', id, name, path, 
  CASE WHEN path IN ('/processing-flow', '/admin/deputy', '/warroom-management', '/report-publish', '/report-line-management') THEN 0 ELSE 1 END,
  0, 0
FROM menus WHERE id >= 17;
