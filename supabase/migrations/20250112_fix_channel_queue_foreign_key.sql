-- Fix channel_queue foreign key to reference the correct users table

-- First, drop the existing foreign key constraint
ALTER TABLE channel_queue 
DROP CONSTRAINT IF EXISTS channel_queue_requested_by_fkey;

-- Add the correct foreign key constraint to reference the public.users table
ALTER TABLE channel_queue 
ADD CONSTRAINT channel_queue_requested_by_fkey 
FOREIGN KEY (requested_by) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Update the RLS policy to use the correct check
DROP POLICY IF EXISTS "Users can view own queue items" ON channel_queue;

CREATE POLICY "Users can view own queue items" ON channel_queue
  FOR SELECT USING (
    requested_by IN (
      SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  );