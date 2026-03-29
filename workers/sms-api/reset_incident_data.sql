-- Reset all incident and transaction data, but keep users and system configuration
-- Run this script carefully in your Cloudflare D1 environment.

-- Delete from child tables first to respect foreign key constraints (if any)
DELETE FROM user_warrooms;
DELETE FROM warroom_attachments;
DELETE FROM warroom_chats;
DELETE FROM aichat_history;
DELETE FROM autopilot_insight;
DELETE FROM activity_logs;
DELETE FROM knowledge_base;
DELETE FROM incident_assignments;
DELETE FROM incident_history;
DELETE FROM action_results;
DELETE FROM reports; -- Custom reports table

-- Delete from primary tables
DELETE FROM warroom_list;
DELETE FROM incidents;
DELETE FROM received_messages;

-- Reset alert hits if necessary
UPDATE alert_keywords SET hit_count = 0;

-- Optional: Reset auto-increment counters if supported/needed
-- DELETE FROM sqlite_sequence WHERE name IN ('incident_assignments', 'received_messages', 'aichat_history', 'reports');

VACUUM; -- Reclaim space
