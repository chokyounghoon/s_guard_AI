-- Create the code_book (Common Code) table
CREATE TABLE IF NOT EXISTS code_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    description TEXT,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME,
    UNIQUE(category, code)
);

-- Seed initial data for Job Positions (직책)
INSERT INTO code_book (category, code, name, sort_order, reg_dt, mod_dt) VALUES 
('POSITION', 'POS_001', '팀원', 10, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_002', '파트장', 20, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_003', '팀장', 30, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_004', '본부장', 40, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_005', '상무', 50, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_006', '부사장', 60, '2026-03-28 13:40:00', '2026-03-28 13:40:00'),
('POSITION', 'POS_007', '사장', 70, '2026-03-28 13:40:00', '2026-03-28 13:40:00');
