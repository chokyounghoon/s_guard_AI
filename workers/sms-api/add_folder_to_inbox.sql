-- Migration to add folder column to inbox_items
ALTER TABLE inbox_items ADD COLUMN folder TEXT DEFAULT 'INBOX';
CREATE INDEX IF NOT EXISTS idx_inbox_items_folder ON inbox_items(folder);
CREATE INDEX IF NOT EXISTS idx_inbox_items_sender ON inbox_items(sender_id);
