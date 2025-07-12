# Fix Video Chat Error - Apply Rate Limits Migration

The video chat is failing because the `rate_limits` table is missing. Here's how to fix it:

## Option 1: Quick Fix (Already Applied)
I've already updated the code to handle the missing table gracefully. The chat should now work even without the rate_limits table.

## Option 2: Proper Fix - Create the Rate Limits Table

1. **Go to your Supabase Dashboard**
   - Navigate to the SQL Editor

2. **Run this SQL migration:**

```sql
-- Create rate_limits table with all required fields
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  type TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT rate_limits_unique_key UNIQUE (identifier, type, tier, period, window_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_lookup ON rate_limits(identifier, type, tier, period, window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

3. **Verify it worked:**
   - Try chatting with a video again
   - The error should be gone

## What was happening:
- The chat API was trying to check rate limits
- The `rate_limits` table didn't exist
- This caused a database error
- The error wasn't handled properly, resulting in HTTP 500

## What I fixed:
- Added error handling to the rate limit checks
- If the table doesn't exist, the chat will still work
- Rate limiting will be disabled until the table is created
- Default rate limits are used for display purposes