# Channel ID Migration for Chat Sessions

The channel chat feature requires adding a `channel_id` column to the `chat_sessions` table.

## How to Apply

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the following SQL:

```sql
-- Add channel_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel_id ON public.chat_sessions(channel_id);

-- Update RLS policies to include channel_id
-- Users can view their own sessions (including channel sessions)
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can view their own sessions" ON public.chat_sessions
    FOR SELECT USING (
        auth.uid()::text = user_id OR 
        (anon_id IS NOT NULL AND anon_id = current_setting('app.anon_id', true))
    );

-- Users can create their own sessions (including channel sessions)
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can create their own sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id OR 
        (user_id IS NULL AND anon_id IS NOT NULL)
    );
```

## What This Does

1. Adds a `channel_id` column to track chat sessions for entire channels (not just individual videos)
2. Creates an index for fast lookups
3. Updates security policies to work with channel sessions

## Note

Until this migration is applied, channel chat sessions will use temporary session IDs and won't be persisted to the database. The chat will still work, but conversation history won't be saved.