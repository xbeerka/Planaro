-- Migration: Fix all sequences
-- Date: 2025-12-16
-- Purpose: Reset auto-increment sequences for all tables to prevent duplicate key errors
-- This is useful after manual data imports or migrations

-- Fix grades sequence
SELECT setval(
  pg_get_serial_sequence('grades', 'id'), 
  COALESCE((SELECT MAX(id) FROM grades), 0) + 1, 
  false
);

-- Fix companies sequence
SELECT setval(
  pg_get_serial_sequence('companies', 'id'), 
  COALESCE((SELECT MAX(id) FROM companies), 0) + 1, 
  false
);

-- Fix departments sequence
SELECT setval(
  pg_get_serial_sequence('departments', 'id'), 
  COALESCE((SELECT MAX(id) FROM departments), 0) + 1, 
  false
);

-- Fix users sequence
SELECT setval(
  pg_get_serial_sequence('users', 'id'), 
  COALESCE((SELECT MAX(id) FROM users), 0) + 1, 
  false
);

-- Fix projects sequence
SELECT setval(
  pg_get_serial_sequence('projects', 'id'), 
  COALESCE((SELECT MAX(id) FROM projects), 0) + 1, 
  false
);

-- Fix events sequence
SELECT setval(
  pg_get_serial_sequence('events', 'id'), 
  COALESCE((SELECT MAX(id) FROM events), 0) + 1, 
  false
);

-- Fix workspaces sequence
SELECT setval(
  pg_get_serial_sequence('workspaces', 'id'), 
  COALESCE((SELECT MAX(id) FROM workspaces), 0) + 1, 
  false
);

-- Verification: Check all sequences
SELECT 
  'grades' as table_name,
  (SELECT last_value FROM grades_id_seq) as current_seq,
  (SELECT MAX(id) FROM grades) as max_id
UNION ALL
SELECT 
  'companies',
  (SELECT last_value FROM companies_id_seq),
  (SELECT MAX(id) FROM companies)
UNION ALL
SELECT 
  'departments',
  (SELECT last_value FROM departments_id_seq),
  (SELECT MAX(id) FROM departments)
UNION ALL
SELECT 
  'users',
  (SELECT last_value FROM users_id_seq),
  (SELECT MAX(id) FROM users)
UNION ALL
SELECT 
  'projects',
  (SELECT last_value FROM projects_id_seq),
  (SELECT MAX(id) FROM projects)
UNION ALL
SELECT 
  'events',
  (SELECT last_value FROM events_id_seq),
  (SELECT MAX(id) FROM events)
UNION ALL
SELECT 
  'workspaces',
  (SELECT last_value FROM workspaces_id_seq),
  (SELECT MAX(id) FROM workspaces);

-- Expected result: current_seq should be >= max_id + 1 for all tables