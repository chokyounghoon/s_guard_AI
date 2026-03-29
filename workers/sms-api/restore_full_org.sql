-- Clear existing data
DELETE FROM organizations;

-- Reset SQLite sequence for ID auto-increment
DELETE FROM sqlite_sequence WHERE name = 'organizations';

-- Depth 1: Shinhan Group Subsidiaries (18 companies)
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (1, '신한DS', 'COM_001', NULL, 1, 0);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (2, '신한금융지주', 'COM_002', NULL, 1, 1);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (3, '신한은행', 'COM_003', NULL, 1, 2);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (4, '신한카드', 'COM_004', NULL, 1, 3);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (5, '신한투자증권', 'COM_005', NULL, 1, 4);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (6, '신한라이프', 'COM_006', NULL, 1, 5);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (7, '신한캐피탈', 'COM_007', NULL, 1, 6);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (8, '신한자산운용', 'COM_008', NULL, 1, 7);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (9, '신한저축은행', 'COM_009', NULL, 1, 8);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (10, '신한AI', 'COM_010', NULL, 1, 9);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (11, '신한벤처투자', 'COM_011', NULL, 1, 10);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (12, '신한서브', 'COM_012', NULL, 1, 11);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (13, '신한신용정보', 'COM_013', NULL, 1, 12);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (14, '신한리츠운용', 'COM_014', NULL, 1, 13);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (15, '신한펀드파트너스', 'COM_015', NULL, 1, 14);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (16, '신한EZ손해보험', 'COM_016', NULL, 1, 15);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (17, '신한씨앤에스', 'COM_017', NULL, 1, 16);
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (18, '신한큐브리스크컨설팅', 'COM_018', NULL, 1, 17);

-- Depth 2-5: 신한DS Hierarchy (Parent ID: 1)
-- Depth 2: 본부
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (19, 'IT본부', 'DIV_001_1', 1, 2, 0);

-- Depth 3: 부서
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (20, '플랫폼서비스부', 'DIV_001_1_1', 19, 3, 0);

-- Depth 4: 팀
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (21, '플랫폼기획팀', 'DIV_001_1_1_1', 20, 4, 0);

-- Depth 5: 파트
INSERT INTO organizations (id, name, code, parent_id, depth, sort_order) VALUES (22, '모바일공통파트', 'DIV_001_1_1_1_1', 21, 5, 0);

-- Add "해당없음" (N/A) entries for other levels of Shinhan DS to avoid empty dropdowns
-- Depth 3 for IT본부 (if other Depts exist)
-- Depth 4 for 플랫폼서비스부 (if other Teams exist)
-- Depth 5 for 플랫폼기획팀 (if other Parts exist)

-- Add "해당없음" (N/A) placeholders for other subsidiaries at all levels (2-5)
-- We'll just define Depth 2 for the other 17 companies for now to keep it clean.
INSERT INTO organizations (name, code, parent_id, depth, sort_order) 
SELECT '해당없음', 'NA_' || code, id, 2, 99 
FROM organizations 
WHERE depth = 1 AND id != 1;
