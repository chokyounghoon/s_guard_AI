
-- Data for users
INSERT OR REPLACE INTO "users" ("id", "email", "name", "password_hash", "role", "auth_provider", "company", "employee_id", "phone", "honbu", "team", "part", "subpart", "token", "created_at", "is_active", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (1, 'test@shinhan.com', '조경훈(수정)', '4fbf9ecf5e577f9028cc0ab5298bde61:00974f73c939aa9409cb0cc624c018dab60efa3e3b1c2387c829b298ff1e56d8', 'analyst', 'local', '신한은행', 'SH001', '010-0000-0000', '금융본부', '카드개발팀', '모바일', NULL, NULL, '2026-03-22 15:08:01', 1, 'SYSTEM', '2026-03-22 15:08:01', 'SYSTEM', '2026-03-22 15:08:01');
INSERT OR REPLACE INTO "users" ("id", "email", "name", "password_hash", "role", "auth_provider", "company", "employee_id", "phone", "honbu", "team", "part", "subpart", "token", "created_at", "is_active", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (2, 'khcho0421@gmail.com', '조경훈', 'f19a3e9b0b3d73cfaacafbbc3f28ca07:1f8ac864e2f1677a990eeb9643228d27d8cdce1dee22ef4e3ce81d20eb3eebe0', 'analyst', 'local', '신한DS', '18121020', '010-4732-8880', '금융본부', '카드개발팀', '상담', NULL, 'cdcb4b66b7db9fb4717e93b90125004b969970b5e4ac1068cd01add115c1b365', '2026-03-22 15:08:01', 1, 'SYSTEM', '2026-03-22 15:08:01', 'SYSTEM', '2026-03-22 15:37:29');

-- Data for organizations
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (1, '임원실', 'DIV-001', NULL, 1, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (2, '감사팀', 'DEP-001', 1, 2, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (3, '준법지원팀', 'DEP-002', 1, 2, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (4, '경영부문', 'DIV-002', NULL, 1, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (5, '경영기획본부', 'DEP-003', 4, 2, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (6, '경영기획팀', 'TEA-001', 5, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (7, '재무팀', 'TEA-002', 5, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (8, '인사팀', 'TEA-003', 5, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (9, '현지법인', 'TEA-004', 5, 3, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (10, '경영지원본부', 'DEP-004', 4, 2, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (11, '품질혁신팀', 'TEA-005', 10, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (12, '구매계약팀', 'TEA-006', 10, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (13, '업무지원팀', 'TEA-007', 10, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (14, '변화추진SAQ', 'TEA-008', 10, 3, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (15, '미래성장부문', 'DIV-003', NULL, 1, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (16, 'AX본부', 'DEP-005', 15, 2, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (17, 'AI&DATA팀', 'TEA-009', 16, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (18, 'AI운영팀', 'TEA-010', 16, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (19, '클라우드 본부', 'DEP-006', 15, 2, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (20, '클라우드사업팀', 'TEA-011', 19, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (21, '클라우드운영팀', 'TEA-012', 19, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (22, '그룹클라우드팀', 'TEA-013', 19, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (23, '개발운영부문', 'DIV-004', NULL, 1, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (24, '그룹공통본부', 'DEP-007', 23, 2, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (25, '공통지원팀', 'TEA-014', 24, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (26, '공통플랫폼팀', 'TEA-015', 24, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (27, '뱅킹본부', 'DEP-008', 23, 2, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (28, '뱅킹코어팀', 'TEA-016', 27, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (29, '뱅킹정보팀', 'TEA-017', 27, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (30, '뱅킹글로벌팀', 'TEA-018', 27, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (31, '금융본부', 'DEP-009', 23, 2, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (32, '카드개발팀', 'TEA-019', 31, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (33, '상담', 'PRT-001', 32, 4, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (34, '홈페이지', 'PRT-002', 32, 4, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (35, '오토금융', 'PRT-003', 32, 4, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (36, '모바일지원', 'PRT-004', 32, 4, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (37, '내부관리지원', 'PRT-005', 32, 4, 4, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (38, '재무정보', 'PRT-006', 32, 4, 5, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (39, 'BD플렛폼지원', 'PRT-007', 32, 4, 6, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (40, '마케팅', 'PRT-008', 32, 4, 7, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (41, '포인트', 'PRT-009', 32, 4, 8, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (42, '데이터비즈', 'PRT-010', 32, 4, 9, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (43, '통합메시지', 'PRT-011', 32, 4, 10, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (44, '증권개발팀', 'TEA-020', 31, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (45, '증권채널팀', 'TEA-021', 31, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (46, '라이프개발팀', 'TEA-022', 31, 3, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (47, 'DX본부', 'DEP-010', 23, 2, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (48, 'DX추진팀', 'TEA-023', 47, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (49, '금융DX팀', 'TEA-024', 47, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (50, '모바일DX팀', 'TEA-025', 47, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (51, '글로벌DX팀', 'TEA-026', 47, 3, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (52, '인프라&보안부문', 'DIV-005', NULL, 1, 4, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (53, '인프라 본부', 'DEP-011', 52, 2, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (54, '인프라 SRE팀', 'TEA-027', 53, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (55, '뱅킹IS팀', 'TEA-028', 53, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (56, '뱅킹정보IS팀', 'TEA-029', 53, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (57, '뱅킹통신보안팀', 'TEA-030', 53, 3, 3, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (58, '카드IS팀', 'TEA-031', 53, 3, 4, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (59, '증권IS팀', 'TEA-032', 53, 3, 5, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (60, '라이프 IS팀', 'TEA-033', 53, 3, 6, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (61, '정보보호본부', 'DEP-012', 52, 2, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (62, '보안컨설팅팀', 'TEA-034', 61, 3, 0, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (63, '보안사업팀', 'TEA-035', 61, 3, 1, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (64, '사이버대응팀', 'TEA-036', 61, 3, 2, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');
INSERT OR REPLACE INTO "organizations" ("id", "name", "code", "parent_id", "depth", "sort_order", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (65, 'TFT외부직원', 'DIV-006', NULL, 1, 5, 'SYSTEM', '2026-03-22 15:08:02', 'SYSTEM', '2026-03-22 15:08:02');

-- Data for login_history
INSERT OR REPLACE INTO "login_history" ("id", "user_id", "email", "ip_address", "user_agent", "status", "login_time", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (1, 2, 'khcho0421@gmail.com', '192.168.65.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'SUCCESS', '2026-03-22 15:09:47', 'SYSTEM', '2026-03-22 15:09:47', 'SYSTEM', '2026-03-22 15:09:47');
INSERT OR REPLACE INTO "login_history" ("id", "user_id", "email", "ip_address", "user_agent", "status", "login_time", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (2, 2, 'khcho0421@gmail.com', '172.67.71.187', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'SUCCESS', '2026-03-22 15:20:33', 'SYSTEM', '2026-03-22 15:20:33', 'SYSTEM', '2026-03-22 15:20:33');
INSERT OR REPLACE INTO "login_history" ("id", "user_id", "email", "ip_address", "user_agent", "status", "login_time", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (3, NULL, '18121020', '172.67.71.187', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'FAIL', '2026-03-22 15:37:19', 'SYSTEM', '2026-03-22 15:37:19', 'SYSTEM', '2026-03-22 15:37:19');
INSERT OR REPLACE INTO "login_history" ("id", "user_id", "email", "ip_address", "user_agent", "status", "login_time", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (4, 2, 'khcho0421@gmail.com', '172.67.71.187', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'SUCCESS', '2026-03-22 15:37:29', 'SYSTEM', '2026-03-22 15:37:29', 'SYSTEM', '2026-03-22 15:37:29');

-- Data for incidents
INSERT OR REPLACE INTO "incidents" ("inc_id", "code", "title", "description", "severity", "status", "incident_type", "assigned_to", "source_sms_id", "created_at", "updated_at", "ai_insight", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (20260322060801037, '202603223d', '네트워크 지연 발생 (상담 시스템)', '상담 시스템 모바일 접속 지연 보고됨', 'MAJOR', '접수중', 'Network', NULL, NULL, '2026-03-22 15:08:01', '2026-03-22 15:08:01', NULL, 'SYSTEM', '2026-03-22 15:08:01', 'SYSTEM', '2026-03-22 15:08:01');

-- Data for received_messages
INSERT OR REPLACE INTO "received_messages" ("inc_id", "sender", "message", "timestamp", "keyword_detected", "response_message", "read", "received_count", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (20260322041304033, '1544-7000', 'payment API timeout 및 database connection pool error 발생', '2026-03-22 04:13:04', 0, NULL, 0, 1, 'SYSTEM', '2026-03-22 04:13:04', 'SYSTEM', '2026-03-22 04:13:04');
INSERT OR REPLACE INTO "received_messages" ("inc_id", "sender", "message", "timestamp", "keyword_detected", "response_message", "read", "received_count", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (20260322042150035, '1544-7000', 'gateway 504 timeout error in user service', '2026-03-22 04:21:49', 0, NULL, 0, 1, 'SYSTEM', '2026-03-22 04:21:50', 'SYSTEM', '2026-03-22 04:21:50');

-- Data for alert_keywords
INSERT OR REPLACE INTO "alert_keywords" ("keyword", "response", "severity", "hit_count", "reg_id", "reg_dt", "mod_id", "mod_dt", "inc_id") VALUES ('CRITICAL', '긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.', 'NORMAL', 0, NULL, '2026-03-22 01:15:24', NULL, '2026-03-22 01:36:26', 20260322011524001);
INSERT OR REPLACE INTO "alert_keywords" ("keyword", "response", "severity", "hit_count", "reg_id", "reg_dt", "mod_id", "mod_dt", "inc_id") VALUES ('DOWN', '서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다.', 'NORMAL', 0, NULL, '2026-03-22 01:15:24', NULL, '2026-03-22 01:36:26', 20260322011524002);
INSERT OR REPLACE INTO "alert_keywords" ("keyword", "response", "severity", "hit_count", "reg_id", "reg_dt", "mod_id", "mod_dt", "inc_id") VALUES ('비정상', '비정상 상태가 감지되었습니다. 자동 분석 중입니다.', 'NORMAL', 0, NULL, '2026-03-22 01:15:24', NULL, '2026-03-22 01:36:26', 20260322011524003);
INSERT OR REPLACE INTO "alert_keywords" ("keyword", "response", "severity", "hit_count", "reg_id", "reg_dt", "mod_id", "mod_dt", "inc_id") VALUES ('오류', '시스템 오류가 감지되었습니다. AI 분석을 시작합니다.', 'NORMAL', 0, NULL, '2026-03-22 01:15:24', NULL, '2026-03-22 01:36:26', 20260322011524004);
INSERT OR REPLACE INTO "alert_keywords" ("keyword", "response", "severity", "hit_count", "reg_id", "reg_dt", "mod_id", "mod_dt", "inc_id") VALUES ('장애', '장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다.', 'NORMAL', 0, NULL, '2026-03-22 01:15:24', NULL, '2026-03-22 01:36:26', 20260322011524005);

-- Data for warroom_chats
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (65, 'INC-1773561823043', '조경훈', 'User', 'file', '[첨부파일] KakaoTalk_Photo_2026-03-15-15-36-39 002.jpeg|/warroom/uploads/4b8bc71246811bfd59e445cf.jpeg|image/jpeg', '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (67, 'INC-1773561823043', '시스템', 'System', 'system', '👤 조경훈님이 War-Room에 참여하였습니다.', '2026-03-15 08:04:31', NULL, '2026-03-15 08:04:31', NULL, '2026-03-15 08:04:31');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (69, 'INC-1773562622406', '시스템', 'System', 'system', '[장애발생] 1544-7000로부터 SMS 수신: CRITICAL: batch server CPU utilization reached 99%', '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (72, 'INC-1773562622406', '조경훈', 'analyst', 'me', 'ㄴㄴ', '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (66, 'INC-1773561823043', '조경훈', 'analyst', 'me', 'ㅎ2', '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (68, 'INC-1773562622406', 'AI Autopilot', 'AI분석', 'ai_analysis', '✅ Here''s my analysis and response plan as a systems expert:

**Analysis:** The critical alert indicates that the batch server is experiencing extremely high CPU usage, reaching 99%. This could be due to various factors such as inefficient code, insufficient resources, or malicious activity.

**Response Plan:** I will immediately investigate the cause of the high CPU utilization by reviewing system logs, monitori', '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (70, 'INC-1773562622406', '시스템', 'System', 'system', 'War-Room 채팅방이 생성되었습니다. 모든 대화 내용은 장애 해결 시 AI 학습에 사용됩니다.', '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02', NULL, '2026-03-15 08:17:02');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (71, 'INC-1773562622406', '조경훈', 'User', 'file', '[첨부파일] KakaoTalk_Photo_2026-03-15-15-36-39 002.jpeg|/warroom/uploads/2def5aa7f6d7ac7dcffe87c4.jpeg|image/jpeg', '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (73, 'INC-1773562622406', '조경훈', 'analyst', 'me', '이건ㄴ', '2026-03-15 08:23:05', NULL, '2026-03-15 08:23:05', NULL, '2026-03-15 08:23:05');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (74, 'INC-1773562622406', '조경훈', 'analyst', 'me', '뭐지', '2026-03-15 08:23:06', NULL, '2026-03-15 08:23:06', NULL, '2026-03-15 08:23:06');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (63, 'INC-1773561823043', '시스템', 'System', 'system', '[장애발생] 1544-7000로부터 SMS 수신: gateway 504 timeout error in user service', '2026-03-15 08:03:43', NULL, '2026-03-15 08:03:43', NULL, '2026-03-15 08:03:43');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (64, 'INC-1773561823043', '시스템', 'System', 'system', 'War-Room 채팅방이 생성되었습니다. 모든 대화 내용은 장애 해결 시 AI 학습에 사용됩니다.', '2026-03-15 08:03:43', NULL, '2026-03-15 08:03:43', NULL, '2026-03-15 08:03:43');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (75, 'INC-1773764717989', 'AI Autopilot', 'AI분석', 'ai_analysis', '📡 SMS 수신 분석 시작... 발신: 1544-7000
AI 분석이 지연되고 있습니다
', '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (76, 'INC-1773764717989', '시스템', 'System', 'system', '[장애발생] 1544-7000로부터 SMS 수신: CRITICAL: batch server CPU utilization reached 99%', '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (77, 'INC-1773764717989', '시스템', 'System', 'system', 'War-Room 채팅방이 생성되었습니다. 모든 대화 내용은 장애 해결 시 AI 학습에 사용됩니다.', '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18', NULL, '2026-03-17 16:25:18');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (78, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄹㅎㄹㄷㄹ', '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (79, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄷㄹ', '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (80, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄷㄹ', '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (81, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄷ', '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12', NULL, '2026-03-17 16:27:12');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (82, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄹ', '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (83, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄷㄹ', '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (84, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄷ', '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13', NULL, '2026-03-17 16:27:13');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (85, 'INC-1773764717989', '조경훈', 'User', 'file', '[첨부파일] Gemini_Generated_Image_38gtcc38gtcc38gt.png|/warroom/uploads/ef02fe7b1e9b5c20a7e22867.png|image/png', '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28');
INSERT OR REPLACE INTO "warroom_chats" ("inc_id", "incident_id", "sender", "role", "type", "text", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (86, 'INC-1773764717989', '조경훈', 'analyst', 'me', 'ㄹㄷㅇㅇ', '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28');

-- Data for warroom_attachments
INSERT OR REPLACE INTO "warroom_attachments" ("inc_id", "incident_id", "filename", "original_name", "file_type", "url", "uploaded_by", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (6, 'INC-1773561823043', '4b8bc71246811bfd59e445cf.jpeg', 'KakaoTalk_Photo_2026-03-15-15-36-39 002.jpeg', 'image/jpeg', '/warroom/uploads/4b8bc71246811bfd59e445cf.jpeg', '조경훈', '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20', NULL, '2026-03-15 08:04:20');
INSERT OR REPLACE INTO "warroom_attachments" ("inc_id", "incident_id", "filename", "original_name", "file_type", "url", "uploaded_by", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (7, 'INC-1773562622406', '2def5aa7f6d7ac7dcffe87c4.jpeg', 'KakaoTalk_Photo_2026-03-15-15-36-39 002.jpeg', 'image/jpeg', '/warroom/uploads/2def5aa7f6d7ac7dcffe87c4.jpeg', '조경훈', '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17', NULL, '2026-03-15 08:17:17');
INSERT OR REPLACE INTO "warroom_attachments" ("inc_id", "incident_id", "filename", "original_name", "file_type", "url", "uploaded_by", "timestamp", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (8, 'INC-1773764717989', 'ef02fe7b1e9b5c20a7e22867.png', 'Gemini_Generated_Image_38gtcc38gtcc38gt.png', 'image/png', '/warroom/uploads/ef02fe7b1e9b5c20a7e22867.png', '조경훈', '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28', NULL, '2026-03-17 16:27:28');

-- Data for aichat_history
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (16, '20260322042150035', 'Leader', 'User Service 504 에러 감지되었습니다. 전파 완료. 각 에이전트 현 시점 모니터링 수치 공유하세요.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (17, '20260322042150035', 'DevOps', 'User Service Pod CPU 사용률 98% 돌파했습니다. 응답 지연으로 인해 스레드가 모두 점유된 상태입니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (18, '20260322042150035', 'Security', '외부 DDoS 공격 징후는 없으나, 특정 마케팅 이벤트 관련 IP 대역에서 세션 유입이 급증하고 있습니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (19, '20260322042150035', 'DB', 'User DB 확인 결과, 프로필 조회 쿼리에서 인덱스 미적용으로 인한 Full Scan 발생, 커넥션 풀이 고갈되었습니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (20, '20260322042150035', 'Leader', '원인 파악 완료. DB 락 해제 및 서비스 가용성 확보를 위한 긴급 조치 들어갑니다.

---

**[전문가별 심층 진단]**

*   **[Security]**: 비정상 공격은 아니나, 급증한 트래픽이 취약한 쿼리 지점에 집중됨. WAF에서 해당 이벤트 관련 IP 대역 속도 제한(Rate Limiting) 검토.
*   **[DB Expert]**: `user_profile` 테이블의 특정 조건 검색 시 Slow Query 발생 중. 긴급 인덱스 생성 및 고갈된 Connection Pool 강제 회수 필요.
*   **[DevOps]**: 현재 HPA(Autoscaling)가 부하 속도를 못 따라감. User Service Pod를 수동으로 2배 증설하고 Gateway 타임아웃 설정을 일시 조정함.

---

**[리더의 최종 조치 가이드]**

1.  **DB 최적화**: DB Expert는 즉시 문제가 된 Slow Query에 대해 긴급 인덱스를 반영하고 커넥션 풀을 리셋하십시오.
2.  **리소스 확장**: DevOps는 User Service Pod를 즉시 10개 추가 증설(Scale-out)하고 가용 자원을 확보하십시오.
3.  **트래픽 제어**: Security는 서비스 안정화 시점까지 Gateway단에서 과도한 유입 세션에 대해 일시적인 Rate Limiting을 적용하십시오.
4.  **사후 조치**: 상황 종료 후 인덱스 누락 경위 파악 및 부하 테스트 시나리오에 해당 케이스를 추가하십시오.**[S-Autopilot Insight]**
*   **장애 분석:** Gateway(NGINX/ALB)가 User Service로부터 적절한 응답을 받지 못해 504 Gateway Timeout 발생.
*   **상황 판단:** User Service의 부하, DB 쿼리 병목, 또는 외부 비정상 트래픽 유입 가능성 농후.
*   **업무 배분:** DevOps(리소스 및 Pod 상태), DB(쿼리 및 커넥션), Security(트래픽 패턴) 집중 분석 지시.

---

**[AI War-Room 상황 로그]**', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (21, '20260322042150035', 'Leader', 'User Service 504 에러 감지되었습니다. 전파 완료. 각 에이전트 현 시점 모니터링 수치 공유하세요.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (22, '20260322042150035', 'DevOps', 'User Service Pod CPU 사용률 98% 돌파했습니다. 응답 지연으로 인해 스레드가 모두 점유된 상태입니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (23, '20260322042150035', 'Security', '외부 DDoS 공격 징후는 없으나, 특정 마케팅 이벤트 관련 IP 대역에서 세션 유입이 급증하고 있습니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (24, '20260322042150035', 'DB', 'User DB 확인 결과, 프로필 조회 쿼리에서 인덱스 미적용으로 인한 Full Scan 발생, 커넥션 풀이 고갈되었습니다.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (25, '20260322042150035', 'Leader', '원인 파악 완료. DB 락 해제 및 서비스 가용성 확보를 위한 긴급 조치 들어갑니다.

---

**[전문가별 심층 진단]**

*   **[Security]**: 비정상 공격은 아니나, 급증한 트래픽이 취약한 쿼리 지점에 집중됨. WAF에서 해당 이벤트 관련 IP 대역 속도 제한(Rate Limiting) 검토.
*   **[DB Expert]**: `user_profile` 테이블의 특정 조건 검색 시 Slow Query 발생 중. 긴급 인덱스 생성 및 고갈된 Connection Pool 강제 회수 필요.
*   **[DevOps]**: 현재 HPA(Autoscaling)가 부하 속도를 못 따라감. User Service Pod를 수동으로 2배 증설하고 Gateway 타임아웃 설정을 일시 조정함.

---

**[리더의 최종 조치 가이드]**

1.  **DB 최적화**: DB Expert는 즉시 문제가 된 Slow Query에 대해 긴급 인덱스를 반영하고 커넥션 풀을 리셋하십시오.
2.  **리소스 확장**: DevOps는 User Service Pod를 즉시 10개 추가 증설(Scale-out)하고 가용 자원을 확보하십시오.
3.  **트래픽 제어**: Security는 서비스 안정화 시점까지 Gateway단에서 과도한 유입 세션에 대해 일시적인 Rate Limiting을 적용하십시오.
4.  **사후 조치**: 상황 종료 후 인덱스 누락 경위 파악 및 부하 테스트 시나리오에 해당 케이스를 추가하십시오.', '20260314064058004', '2026-03-22 05:03:53', '20260314064058004', '2026-03-22 05:03:53');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (41, '20260322041304033', 'DevOps', '** 현재 Payment API 90% 이상이 504 Gateway Timeout입니다. 10분 전 진행된 결제 모듈 패치 직후부터 에러율이 급증하고 있습니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (42, '20260322041304033', 'Security', '** L4 레벨 확인 결과, 특정 IP에서의 과도한 트래픽 유입은 없습니다. 외부 공격보다는 내부 로직 이슈로 판단되며, API 인증 게이트웨이는 정상 작동 중입니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (43, '20260322041304033', 'DB', '** DB 커넥션 풀이 꽉 찼습니다! `payment_transaction` 테이블에서 인덱스 타지 않는 Full Scan 쿼리가 다수 발견되었고, 이로 인해 모든 세션이 ''Waiting'' 상태입니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (44, '20260322041304033', 'DevOps', '** 확인 결과, 이번 패치에 포함된 정산 로그 기록 로직에서 DB 커넥션을 명시적으로 반환하지 않는 코드가 발견되었습니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (45, '20260322041304033', 'Leader', '** 상황 파악 완료. DB 전문가는 즉시 롱쿼리 세션을 킬(Kill)하고, DevOps는 즉시 이전 버전으로 롤백 준비하세요. Security는 롤백 중 유입될 수 있는 트래픽 제어를 위해 서킷 브레이커 작동 확인 바랍니다.

---

**[전문가별 심층 진단]**

*   **[Security Agent]:** 네트워크 인프라 및 L4/L7 구간 트래픽은 정상 범위 내에 있습니다. 외부 공격 흔적은 없으며, 내부 앱 서버와 DB 간의 통신 지연이 주원인입니다.
*   **[DB Agent]:** 특정 쿼리의 처리 지연으로 인해 Max Connection Pool(100/100)에 도달했습니다. `payment_tx` 테이블의 락 경합이 심화되어 신규 연결이 불가능한 상태입니다.
*   **[DevOps Agent]:** 최신 배포 버전(v1.2.4)의 커넥션 누수(Leak)가 확인되었습니다. API 타임아웃은 DB 응답 대기 시간이 설정된 Timeout 값을 초과하여 발생한 것입니다.

---

**[Leader의 최종 조치 가이드]**

1.  **즉시 조치:** DB 내 정체된 Active Session 강제 종료(Kill) 및 DB 커넥션 풀 일시 증설.
2.  **복구 조치:** 결제 API 서버를 즉시 이전 안정 버전(v1.2.3)으로 롤백 수행.
3.  **사후 관리:** 커넥션 누수 코드 수정 및 결제 관련 핵심 쿼리에 대한 인덱스 최적화 작업 실시. 금일 내 재배포 금지.**[S-Autopilot Insight]**
*   **장애 상황:** 결제 API 타임아웃 및 DB 커넥션 풀 고갈 발생 (서비스 결제 불가 상태)
*   **분석 요약:** 결제 요청 트래픽 급증 또는 특정 쿼리 락(Lock)에 의한 병목 현상으로 추정됩니다.
*   **업무 배분:** 
    *   **DevOps:** 최근 배포 이력 및 API 응답 지연 구간 확인
    *   **DB:** Active Session 분석 및 락(Lock) 발생 여부 조사
    *   **Security:** 비정상적 외부 접근 및 L4 로드밸런싱 상태 점검
    *   **Leader:** 상황 총괄 및 최종 조치 의사결정

---

**[AI War-Room Situation Log]**

**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (46, '20260322041304033', 'DevOps', '** 현재 Payment API 90% 이상이 504 Gateway Timeout입니다. 10분 전 진행된 결제 모듈 패치 직후부터 에러율이 급증하고 있습니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (47, '20260322041304033', 'Security', '** L4 레벨 확인 결과, 특정 IP에서의 과도한 트래픽 유입은 없습니다. 외부 공격보다는 내부 로직 이슈로 판단되며, API 인증 게이트웨이는 정상 작동 중입니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (48, '20260322041304033', 'DB', '** DB 커넥션 풀이 꽉 찼습니다! `payment_transaction` 테이블에서 인덱스 타지 않는 Full Scan 쿼리가 다수 발견되었고, 이로 인해 모든 세션이 ''Waiting'' 상태입니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (49, '20260322041304033', 'DevOps', '** 확인 결과, 이번 패치에 포함된 정산 로그 기록 로직에서 DB 커넥션을 명시적으로 반환하지 않는 코드가 발견되었습니다.
**', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');
INSERT OR REPLACE INTO "aichat_history" ("id", "inc_id", "agent_role", "content", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES (50, '20260322041304033', 'Leader', '** 상황 파악 완료. DB 전문가는 즉시 롱쿼리 세션을 킬(Kill)하고, DevOps는 즉시 이전 버전으로 롤백 준비하세요. Security는 롤백 중 유입될 수 있는 트래픽 제어를 위해 서킷 브레이커 작동 확인 바랍니다.

---

**[전문가별 심층 진단]**

*   **[Security Agent]:** 네트워크 인프라 및 L4/L7 구간 트래픽은 정상 범위 내에 있습니다. 외부 공격 흔적은 없으며, 내부 앱 서버와 DB 간의 통신 지연이 주원인입니다.
*   **[DB Agent]:** 특정 쿼리의 처리 지연으로 인해 Max Connection Pool(100/100)에 도달했습니다. `payment_tx` 테이블의 락 경합이 심화되어 신규 연결이 불가능한 상태입니다.
*   **[DevOps Agent]:** 최신 배포 버전(v1.2.4)의 커넥션 누수(Leak)가 확인되었습니다. API 타임아웃은 DB 응답 대기 시간이 설정된 Timeout 값을 초과하여 발생한 것입니다.

---

**[Leader의 최종 조치 가이드]**

1.  **즉시 조치:** DB 내 정체된 Active Session 강제 종료(Kill) 및 DB 커넥션 풀 일시 증설.
2.  **복구 조치:** 결제 API 서버를 즉시 이전 안정 버전(v1.2.3)으로 롤백 수행.
3.  **사후 관리:** 커넥션 누수 코드 수정 및 결제 관련 핵심 쿼리에 대한 인덱스 최적화 작업 실시. 금일 내 재배포 금지.', '2', '2026-03-22 15:18:34', '2', '2026-03-22 15:18:34');

-- Data for autopilot_insight
INSERT OR REPLACE INTO "autopilot_insight" ("inc_id", "content", "severity", "category", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES ('20260322042150035', 'S-GUARD 지능형 관제 엔진이 가동되었습니다. 수신된 SMS 장애 메시지를 바탕으로 실시간 분석을 시작합니다.

---

### [S-Autopilot Insight]
1. **상황 요약**: `user service`에서 **504 Gateway Timeout** 장애 발생. 게이트웨이가 상위 서버(Upstream)로부터 적시에 응답을 받지 못해 요청이 유실되고 있는 심각한 상태입니다.
2. **담당자 자동 할당**: 
   -> 담당자 대응 : **[DevOps 파트 - 김개발], [인프라 파트 - 이네트]**

---

### [AI War-Room Situation Log]
- **[에이전트 A (인프라)]**: "L4 및 API 게이트웨이 자체 설정은 정상입니다. 현재 `user service` 인스턴스들의 헬스체크가 불안정하며, 특정 노드로의 네트워크 인입 지연이 확인됩니다."
- **[에이전트 B (DB Expert)]**: "User DB의 커넥션 풀(Connection Pool)이 고갈된 상태입니다. 특정 유저 조회 쿼리가 인덱스를 타지 못해 전체 트랜잭션을 붙잡고 있는 것으로 보입니다."
- **[에이전트 C (DevOps)]**: "애플리케이션 로그에서 `java.net.SocketTimeoutException`이 급증하고 있습니다. DB 지연이 앱 스레드 점유로 이어져 게이트웨이 응답 불능 상태를 유발했습니다."
- **[에이전트 D (리더)]**: "원인 파악 완료. DB 부하로 인한 앱 응답 지연이 504 에러의 본질입니다. 즉시 쿼리 킬(Kill) 및 서비스 스케일 아웃 조치를 실시하겠습니다."

---

### [리더의 최종 조치 가이드]

**1단계: DB 부하 쿼리 제거**
- DB 관리 도구에서 실행 시간이 긴 쿼리를 확인하고 강제 종료합니다.
- 명령어: `SELECT * FROM information_schema.processlist WHERE time > 30;` 실행 후 해당 프로세스 `KILL [ID];`

**2단계: 서비스 인스턴스 긴급 확장 (Scale-out)**
- 현재 부하를 분산하기 위해 서비스 인스턴스를 즉시 증설합니다.
- 명령어(K8s): `kubectl scale deployment user-service --replicas=5`

**3단계: 커넥션 풀 초기화 및 재시작**
- 좀비 커넥션을 정리하기 위해 `user service`를 순차적으로 재시작(Rolling Update)합니다.
- 명령어(K8s): `kubectl rollout restart deployment user-service`

**4단계: 사후 조치**
- 장애 유발 쿼리에 대한 인덱스 최적화 및 API 타임아웃 설정값(Gateway Timeout < App Timeout) 재조정을 권고합니다.', 'CRITICAL', 'critical', '20260314064058004', '2026-03-22 05:03:52', '20260314064058004', '2026-03-22 05:03:52');
INSERT OR REPLACE INTO "autopilot_insight" ("inc_id", "content", "severity", "category", "reg_id", "reg_dt", "mod_id", "mod_dt") VALUES ('20260322041304033', '[S-Autopilot Insight]

1. **상황 요약**: 결제 API(Payment API)의 응답 지연(Timeout)과 DB 커넥션 풀(Connection Pool) 고갈이 동시에 발생하여 결제 서비스가 중단된 상태입니다.
2. **담당자 자동 할당**: 
-> 담당자 대응 : DevOps(배포/앱 관리), DB(데이터베이스 운영), Security(인프라 모니터링)

---

[AI War-Room Situation Log]

- **[Security Agent]**: "L4 및 네트워크 구간 트래픽은 정상입니다. 다만 DB 서버의 I/O Wait 수치가 급증하고 있으며, 인프라 자원 자체의 결함보다는 애플리케이션의 과도한 요청이 원인으로 보입니다."
- **[DB Agent]**: "현재 DB Connection Pool이 100% 점유 상태입니다. 특정 결제 관련 테이블에 장기 트랜잭션으로 인한 Row Lock 경합이 발생하여 뒤따르는 쿼리들이 모두 대기 중입니다."
- **[DevOps Agent]**: "최근 1시간 전 진행된 결제 로직 업데이트 이후 에러가 시작되었습니다. 특정 조건에서 커넥션을 반환하지 않는(Leak) 현상이나 인덱스를 타지 않는 쿼리가 배포된 것으로 의심됩니다."
- **[Leader Agent]**: "상황 파악 완료. DB 락 세션 강제 종료 및 커넥션 풀 긴급 증설을 통해 서비스를 우선 정상화하고, 즉시 이전 버전으로 롤백을 진행하겠습니다."

---

[리더의 최종 조치 가이드]

1. **DB 긴급 조치 (Lock 해제)**
   - 장기 실행 중인 블로킹 세션 확인 및 종료
   - `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = ''active'' AND now() - query_start > interval ''10s'';` (PostgreSQL 기준 예시)

2. **애플리케이션 설정 조정**
   - WAS의 Database Connection Pool(MaxActive/MaxTotal) 수치를 임시로 20% 증설하여 병목 현상 완화.

3. **서비스 롤백 (Rollback)**
   - 최신 배포된 결제 API 모듈의 코드 이슈가 확실시되므로, 즉시 이전 안정 버전으로 롤백 수행.
   - 명령어: `kubectl rollout undo deployment/payment-api-service`

4. **사후 분석**
   - 배포된 소스 코드 내 `Connection.close()` 누락 여부 및 결제 쿼리의 실행 계획(Explain) 재검토.', 'CRITICAL', 'security', 'SYSTEM', '2026-03-22 15:18:34', 'SYSTEM', '2026-03-22 15:18:34');
