-- Runs once, the first time the MariaDB container starts.
-- Creates a separate database for the account deletion test.
CREATE DATABASE IF NOT EXISTS syncpads_test;
GRANT ALL PRIVILEGES ON syncpads_test.* TO 'syncpads'@'%';

