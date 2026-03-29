-- ======================================================
-- S-Guard AI Organization Data Reset & Seed
-- ======================================================

-- 1. Clear existing organization data to ensure a clean hierarchy
DELETE FROM organizations;
DELETE FROM sqlite_sequence WHERE name = 'organizations';

-- 2. Insert Shinhan Group Companies (Depth 1)
-- Sequential IDs will be used for parent_id mapping in step 3
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한DS', 'COM_001', 1, 0); -- ID 1
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한금융지주', 'COM_002', 1, 10); -- ID 2
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한은행', 'COM_003', 1, 20); -- ID 3
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한카드', 'COM_004', 1, 30); -- ID 4
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한투자증권', 'COM_005', 1, 40); -- ID 5
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한라이프', 'COM_006', 1, 50); -- ID 6
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한캐피탈', 'COM_007', 1, 60); -- ID 7
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한자산운용', 'COM_008', 1, 70); -- ID 8
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한저축은행', 'COM_009', 1, 80); -- ID 9
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한AI', 'COM_010', 1, 90); -- ID 10
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('제주은행', 'COM_011', 1, 100); -- ID 11
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한벤처투자', 'COM_012', 1, 110); -- ID 12
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한리츠운용', 'COM_013', 1, 120); -- ID 13
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한대체투자운용', 'COM_014', 1, 130); -- ID 14
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한자산신탁', 'COM_015', 1, 140); -- ID 15
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한펀드파트너스', 'COM_016', 1, 150); -- ID 16
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한금융플러스', 'COM_017', 1, 160); -- ID 17
INSERT INTO organizations (name, code, depth, sort_order) VALUES ('신한큐브리스크컨설팅', 'COM_018', 1, 170); -- ID 18

-- 3. Insert Common Divisions (Depth 2) for Each Company
-- We map these to their respective company (Depth 1) via parent_id
-- Codes follow the format: DIV_{COM_CODE}_{SEQ}

INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('IT본부', 'DIV_001_1', 1, 2, 0);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('경영지원부문', 'DIV_001_2', 1, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('보안운영센터', 'DIV_001_3', 1, 2, 20);

INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('디지털사업부문', 'DIV_002_1', 2, 2, 0);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('그룹보안전략', 'DIV_002_2', 2, 2, 10);

INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('ICT그룹', 'DIV_003_1', 3, 2, 0);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('영업지원부문', 'DIV_003_2', 3, 2, 10);

INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('플랫폼사업본부', 'DIV_004_1', 4, 2, 0);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('IT인프라팀', 'DIV_004_2', 4, 2, 10);

INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('디지털부문', 'DIV_005_1', 5, 2, 0);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('정보보호본부', 'DIV_005_2', 5, 2, 10);

-- Adding representative divisions for remaining companies to verify dropdown
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('고객지원부', 'DIV_006_1', 6, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('리스크관리팀', 'DIV_007_1', 7, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('운용본부', 'DIV_008_1', 8, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('디지털혁신실', 'DIV_009_1', 9, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('AI연구소', 'DIV_010_1', 10, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('전산부', 'DIV_011_1', 11, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('기업지원부', 'DIV_012_1', 12, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('운용혁신팀', 'DIV_013_1', 13, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('대체투자본부', 'DIV_014_1', 14, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('신탁업무팀', 'DIV_015_1', 15, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('펀드개발팀', 'DIV_016_1', 16, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('영업추진본부', 'DIV_017_1', 17, 2, 10);
INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES ('기술컨설팅팀', 'DIV_018_1', 18, 2, 10);
