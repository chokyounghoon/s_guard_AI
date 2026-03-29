-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Example: Manual update to set an admin (to be run by user)
-- UPDATE users SET is_admin = 1 WHERE employee_id = 'YOUR_EMP_ID';
