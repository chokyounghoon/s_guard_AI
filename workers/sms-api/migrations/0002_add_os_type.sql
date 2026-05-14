-- Migration to add os_type to users table
ALTER TABLE users ADD COLUMN os_type TEXT;
