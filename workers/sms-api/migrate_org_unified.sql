-- 1. Shift existing depths down by 1 (1->2, 2->3, 3->4, 4->5)
UPDATE organizations SET depth = depth + 1;

-- 2. Insert Companies as Depth 1 nodes
INSERT INTO organizations (name, code, depth, sort_order) VALUES 
('신한DS', 'COM_001', 1, 0),
('신한금융지주', 'COM_002', 1, 10),
('신한은행', 'COM_003', 1, 20),
('신한카드', 'COM_004', 1, 30),
('신한투자증권', 'COM_005', 1, 40),
('신한라이프', 'COM_006', 1, 50),
('신한캐피탈', 'COM_007', 1, 60),
('신한자산운용', 'COM_008', 1, 70),
('신한저축은행', 'COM_009', 1, 80),
('신한AI', 'COM_010', 1, 90),
('제주은행', 'COM_011', 1, 100),
('신한벤처투자', 'COM_012', 1, 110),
('신한리츠운용', 'COM_013', 1, 120),
('신한대체투자운용', 'COM_014', 1, 130),
('신한자산신탁', 'COM_015', 1, 140),
('신한펀드파트너스', 'COM_016', 1, 150),
('신한금융플러스', 'COM_017', 1, 160),
('신한큐브리스크컨설팅', 'COM_018', 1, 170);

-- 3. Link former Depth 1 (now Depth 2) nodes to '신한DS' (Depth 1) parent
-- We need the ID of the new '신한DS' node.
UPDATE organizations 
SET parent_id = (SELECT id FROM organizations WHERE name = '신한DS' AND depth = 1)
WHERE depth = 2 AND parent_id IS NULL;
