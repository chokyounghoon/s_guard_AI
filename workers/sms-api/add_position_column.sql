-- Add position column to users table
ALTER TABLE users ADD COLUMN position TEXT;

-- Update existing users to have a default position if needed
-- UPDATE users SET position = '팀원' WHERE position IS NULL;
