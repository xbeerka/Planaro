-- Migration: Add workspace_id to companies table
-- Date: 2025-12-16
-- Purpose: Isolate companies by workspace (similar to grades)

-- Step 1: Add workspace_id column (nullable initially)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS workspace_id INTEGER;

-- Step 2: Add foreign key constraint
-- This ensures that workspace_id references an actual workspace
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS fk_companies_workspace;

ALTER TABLE companies
ADD CONSTRAINT fk_companies_workspace
FOREIGN KEY (workspace_id) 
REFERENCES workspaces(id) 
ON DELETE CASCADE;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_companies_workspace_id 
ON companies(workspace_id);

-- Step 4: Migrate existing data
-- Option A: Assign all existing companies to the first workspace
UPDATE companies 
SET workspace_id = (SELECT id FROM workspaces ORDER BY id LIMIT 1)
WHERE workspace_id IS NULL;

-- Option B: Delete old companies if they are not needed
-- Uncomment the line below if you want to start fresh:
-- DELETE FROM companies WHERE workspace_id IS NULL;

-- Step 5: Make workspace_id required (NOT NULL)
-- Only run this after all existing records have workspace_id populated
ALTER TABLE companies 
ALTER COLUMN workspace_id SET NOT NULL;

-- Verification queries:
-- SELECT * FROM companies ORDER BY workspace_id, id;
-- SELECT COUNT(*) as total, workspace_id FROM companies GROUP BY workspace_id;
