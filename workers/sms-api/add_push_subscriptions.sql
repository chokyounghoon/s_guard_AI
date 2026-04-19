-- Create push_subscriptions table for Web Push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reg_id TEXT DEFAULT 'SYSTEM',
    reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    mod_id TEXT DEFAULT 'SYSTEM',
    mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(employee_id)
);

-- Ensure priority_score exists in incidents (if not already added)
-- Based on grep, priority_flag/score are in received_messages, adding to incidents for cleaner push logic
ALTER TABLE incidents ADD COLUMN priority_flag INTEGER DEFAULT 0;
ALTER TABLE incidents ADD COLUMN priority_score REAL DEFAULT 0.0;
ALTER TABLE incidents ADD COLUMN corrected_content TEXT;
