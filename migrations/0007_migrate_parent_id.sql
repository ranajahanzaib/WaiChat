-- Step 1: Add a temporary column to store the new parent_id to avoid overriding data we still need
ALTER TABLE messages ADD COLUMN new_parent_id TEXT;

-- Step 2: Compute the new parent_id for messages that were in the main trunk (no parent_id)
-- We use LAG() to get the ID of the immediately preceding message based on created_at and rowid.
WITH RankedMessages AS (
  SELECT id, LAG(id) OVER (PARTITION BY conversation_id ORDER BY created_at ASC, rowid ASC) as prev_id
  FROM messages
  WHERE parent_id IS NULL
)
UPDATE messages
SET new_parent_id = (SELECT prev_id FROM RankedMessages WHERE RankedMessages.id = messages.id)
WHERE parent_id IS NULL;

-- Step 3: For assistant retries (parent_id IS NOT NULL), their new parent_id should be
-- the new parent_id of the original message they were retrying.
UPDATE messages
SET new_parent_id = (
  SELECT new_parent_id 
  FROM messages m2 
  WHERE m2.id = messages.parent_id
)
WHERE parent_id IS NOT NULL;

-- Step 4: Swap columns
ALTER TABLE messages DROP COLUMN parent_id;
ALTER TABLE messages RENAME COLUMN new_parent_id TO parent_id;
