-- Complete rate_limits table creation with all required fields
-- This migration creates the table if it doesn't exist with the full structure

-- Drop the table if you need to recreate it completely (be careful with this in production!)
-- DROP TABLE IF EXISTS rate_limits CASCADE;

-- Create rate_limits table with all required fields
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- User ID, API key, or IP address
  type TEXT NOT NULL, -- Type of rate limit (chat, api, video, etc.)
  tier TEXT NOT NULL DEFAULT 'free', -- User tier (free, pro, enterprise)
  period TEXT NOT NULL, -- Time period (minute, hour, day, month)
  count INTEGER NOT NULL DEFAULT 0, -- Current count in the window
  window_start TIMESTAMP WITH TIME ZONE NOT NULL, -- Start of current window
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When this window expires
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure we don't have duplicate rate limit entries
  CONSTRAINT rate_limits_unique_key UNIQUE (identifier, type, tier, period, window_start)
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_type ON rate_limits(type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_tier ON rate_limits(tier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_type ON rate_limits(identifier, type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_lookup ON rate_limits(identifier, type, tier, period, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_active_windows ON rate_limits(identifier, type, tier, period) 
  WHERE expires_at > NOW();

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Service role full access to rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Users can view their own rate limits" ON rate_limits;

-- Policy: Service role has full access
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view their own rate limits
CREATE POLICY "Users view own rate limits" ON rate_limits
  FOR SELECT
  TO authenticated
  USING (identifier = auth.uid()::text);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create a rate limit entry
CREATE OR REPLACE FUNCTION get_or_create_rate_limit(
  p_identifier TEXT,
  p_type TEXT,
  p_tier TEXT,
  p_period TEXT,
  p_window_duration INTERVAL
)
RETURNS rate_limits AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_rate_limit rate_limits;
BEGIN
  -- Calculate the current window start based on the period
  CASE p_period
    WHEN 'minute' THEN 
      v_window_start := date_trunc('minute', NOW());
    WHEN 'hour' THEN 
      v_window_start := date_trunc('hour', NOW());
    WHEN 'day' THEN 
      v_window_start := date_trunc('day', NOW());
    WHEN 'month' THEN 
      v_window_start := date_trunc('month', NOW());
    ELSE
      v_window_start := NOW();
  END CASE;
  
  v_expires_at := v_window_start + p_window_duration;
  
  -- Try to get existing rate limit
  SELECT * INTO v_rate_limit
  FROM rate_limits
  WHERE identifier = p_identifier
    AND type = p_type
    AND tier = p_tier
    AND period = p_period
    AND window_start = v_window_start
    AND expires_at > NOW()
  FOR UPDATE;
  
  -- If not found, create new one
  IF NOT FOUND THEN
    INSERT INTO rate_limits (identifier, type, tier, period, count, window_start, expires_at)
    VALUES (p_identifier, p_type, p_tier, p_period, 0, v_window_start, v_expires_at)
    RETURNING * INTO v_rate_limit;
  END IF;
  
  RETURN v_rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit count
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_identifier TEXT,
  p_type TEXT,
  p_tier TEXT,
  p_period TEXT,
  p_window_duration INTERVAL,
  p_increment INTEGER DEFAULT 1
)
RETURNS rate_limits AS $$
DECLARE
  v_rate_limit rate_limits;
BEGIN
  -- Get or create the rate limit entry
  v_rate_limit := get_or_create_rate_limit(p_identifier, p_type, p_tier, p_period, p_window_duration);
  
  -- Increment the count
  UPDATE rate_limits
  SET count = count + p_increment
  WHERE id = v_rate_limit.id
  RETURNING * INTO v_rate_limit;
  
  RETURN v_rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check if rate limit is exceeded
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_type TEXT,
  p_tier TEXT,
  p_period TEXT,
  p_window_duration INTERVAL,
  p_limit INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_rate_limit rate_limits;
BEGIN
  -- Get or create the rate limit entry
  v_rate_limit := get_or_create_rate_limit(p_identifier, p_type, p_tier, p_period, p_window_duration);
  
  -- Return true if under limit, false if exceeded
  RETURN v_rate_limit.count < p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits 
  WHERE expires_at < NOW() - INTERVAL '1 hour'; -- Keep for 1 hour after expiry for debugging
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE rate_limits IS 'Tracks API rate limits for users and services';
COMMENT ON COLUMN rate_limits.identifier IS 'Unique identifier for the rate limited entity (user ID, API key, IP address)';
COMMENT ON COLUMN rate_limits.type IS 'Type of action being rate limited (chat, api, video, channel_process, etc.)';
COMMENT ON COLUMN rate_limits.tier IS 'User subscription tier (free, pro, enterprise)';
COMMENT ON COLUMN rate_limits.period IS 'Time period for the rate limit (minute, hour, day, month)';
COMMENT ON COLUMN rate_limits.count IS 'Number of requests made in the current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start timestamp of the current rate limit window';
COMMENT ON COLUMN rate_limits.expires_at IS 'When this rate limit window expires';

-- Example usage:
-- Check if user can make a chat request (e.g., 10 per minute for free tier)
-- SELECT check_rate_limit('user-id-123', 'chat', 'free', 'minute', INTERVAL '1 minute', 10);
--
-- Increment rate limit count after successful request
-- SELECT increment_rate_limit('user-id-123', 'chat', 'free', 'minute', INTERVAL '1 minute', 1);