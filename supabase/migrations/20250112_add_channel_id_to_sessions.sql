-- Add channel_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE;

-- Add index for efficient queries
CREATE INDEX idx_chat_sessions_channel_id ON public.chat_sessions(channel_id);

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