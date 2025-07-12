-- Migration to convert anonymous sessions to user sessions when users sign in
-- This creates a function that can be called when a user authenticates

-- Function to migrate anonymous sessions to authenticated user
CREATE OR REPLACE FUNCTION migrate_anon_sessions_to_user(
  p_user_id UUID,
  p_anon_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_migrated_count INTEGER := 0;
  v_message_count INTEGER := 0;
  v_session_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_anon_id IS NULL OR p_anon_id = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid parameters: user_id and anon_id are required'
    );
  END IF;

  -- Start transaction
  BEGIN
    -- 1. Migrate chat sessions
    WITH migrated_sessions AS (
      UPDATE chat_sessions
      SET 
        user_id = p_user_id,
        anon_id = NULL,
        updated_at = NOW()
      WHERE 
        anon_id = p_anon_id
        AND user_id IS NULL
      RETURNING id
    )
    SELECT 
      COUNT(*),
      ARRAY_AGG(id)
    INTO 
      v_migrated_count,
      v_session_ids
    FROM migrated_sessions;

    -- 2. Count messages in migrated sessions
    SELECT COUNT(*)
    INTO v_message_count
    FROM chat_messages
    WHERE session_id = ANY(v_session_ids);

    -- 3. Update rate limits - merge anonymous usage into user's limits
    -- This ensures the user doesn't get extra quota by signing in
    UPDATE rate_limits
    SET 
      count = rate_limits.count + COALESCE(anon_limits.count, 0),
      updated_at = NOW()
    FROM (
      SELECT period, count
      FROM rate_limits
      WHERE identifier = p_anon_id
    ) AS anon_limits
    WHERE 
      rate_limits.identifier = p_user_id::TEXT
      AND rate_limits.period = anon_limits.period;

    -- 4. Clean up anonymous rate limits
    DELETE FROM rate_limits
    WHERE identifier = p_anon_id;

    -- 5. Log the migration for auditing
    INSERT INTO user_events (
      user_id,
      event_type,
      event_data,
      created_at
    ) VALUES (
      p_user_id,
      'anon_session_migration',
      json_build_object(
        'anon_id', p_anon_id,
        'sessions_migrated', v_migrated_count,
        'messages_migrated', v_message_count,
        'session_ids', v_session_ids
      ),
      NOW()
    ) ON CONFLICT DO NOTHING;

    -- Return success with migration details
    RETURN json_build_object(
      'success', true,
      'sessions_migrated', v_migrated_count,
      'messages_migrated', v_message_count,
      'session_ids', v_session_ids
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic in a function
      RETURN json_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION migrate_anon_sessions_to_user(UUID, TEXT) TO authenticated;

-- Create index for faster anon_id lookups if not exists
CREATE INDEX IF NOT EXISTS idx_chat_sessions_anon_id ON chat_sessions(anon_id) 
WHERE anon_id IS NOT NULL;

-- Create user_events table if it doesn't exist (for audit logging)
CREATE TABLE IF NOT EXISTS user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_event UNIQUE (user_id, event_type, created_at)
);

-- Create index on user_events for faster queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);

-- Sample usage:
-- SELECT migrate_anon_sessions_to_user('user-uuid-here', 'anon_device_abc123');