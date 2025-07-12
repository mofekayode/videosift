-- Update rate_limits table to include type, tier, and period fields
-- First, drop the existing unique constraint that might conflict
DROP INDEX IF EXISTS idx_rate_limits_unique;

-- Add the missing columns
ALTER TABLE rate_limits 
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS period TEXT;

-- Update the action column to be type if needed (or keep both)
-- For backward compatibility, we'll keep action and add type as a new column

-- Create a new unique constraint that includes the new fields
CREATE UNIQUE INDEX idx_rate_limits_unique_v2 ON rate_limits(identifier, type, tier, period, window_start);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_rate_limits_type ON rate_limits(type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_tier ON rate_limits(tier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_type_tier ON rate_limits(type, tier);

-- Update the RLS policy to be more specific
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;

CREATE POLICY "Service role full access to rate limits" ON rate_limits
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add a policy for authenticated users to read their own rate limits
CREATE POLICY "Users can view their own rate limits" ON rate_limits
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND 
    identifier = auth.uid()::text
  );

-- Create or replace the updated trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the table structure
COMMENT ON TABLE rate_limits IS 'Tracks API rate limits for users and services';
COMMENT ON COLUMN rate_limits.identifier IS 'User ID or IP address';
COMMENT ON COLUMN rate_limits.type IS 'Type of rate limit (e.g., chat, api, video)';
COMMENT ON COLUMN rate_limits.tier IS 'User tier (free, pro, enterprise)';
COMMENT ON COLUMN rate_limits.period IS 'Time period (minute, hour, day, month)';
COMMENT ON COLUMN rate_limits.count IS 'Number of requests in the current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the current rate limit window';