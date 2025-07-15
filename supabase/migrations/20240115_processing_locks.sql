-- Create processing locks table for distributed locking
CREATE TABLE IF NOT EXISTS processing_locks (
  resource_id TEXT PRIMARY KEY,
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  instance_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup queries
CREATE INDEX idx_processing_locks_expires_at ON processing_locks(expires_at);

-- Add comment
COMMENT ON TABLE processing_locks IS 'Distributed locks for preventing concurrent processing of resources';
COMMENT ON COLUMN processing_locks.resource_id IS 'Unique identifier for the resource being locked (e.g., video_123, channel_456)';
COMMENT ON COLUMN processing_locks.expires_at IS 'When this lock expires and can be cleaned up';
COMMENT ON COLUMN processing_locks.instance_id IS 'Optional identifier for the instance holding the lock';

-- Create a function to automatically clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM processing_locks
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired locks every hour
-- Note: This requires pg_cron extension which may not be available in all Supabase plans
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-expired-locks', '0 * * * *', 'SELECT cleanup_expired_locks();');