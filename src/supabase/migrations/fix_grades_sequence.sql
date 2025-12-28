-- Migration: Fix grades sequence
-- Date: 2025-12-16
-- Purpose: Reset the auto-increment sequence for grades table to prevent duplicate key errors

-- Step 1: Check current max ID
SELECT MAX(id) FROM grades;

-- Step 2: Reset sequence to max ID + 1
-- This ensures the next auto-generated ID will be higher than any existing ID
SELECT setval(pg_get_serial_sequence('grades', 'id'), COALESCE((SELECT MAX(id) FROM grades), 0) + 1, false);

-- Verification: Check that the sequence is now correct
SELECT 
  last_value as current_sequence_value,
  (SELECT MAX(id) FROM grades) as max_id_in_table 
FROM grades_id_seq;

-- Expected result: current_sequence_value should be >= max_id_in_table + 1