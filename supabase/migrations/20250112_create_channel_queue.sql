-- Create channel_queue table for processing channels
CREATE TABLE IF NOT EXISTS channel_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  videos_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_channel_queue_status ON channel_queue(status);
CREATE INDEX idx_channel_queue_channel_id ON channel_queue(channel_id);
CREATE INDEX idx_channel_queue_requested_by ON channel_queue(requested_by);

-- Enable RLS
ALTER TABLE channel_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own queue items
CREATE POLICY "Users can view own queue items" ON channel_queue
  FOR SELECT USING (requested_by = auth.uid());

-- Service role can do everything
CREATE POLICY "Service role full access" ON channel_queue
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_channel_queue_updated_at
  BEFORE UPDATE ON channel_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add some helpful comments
COMMENT ON TABLE channel_queue IS 'Queue for processing YouTube channels';
COMMENT ON COLUMN channel_queue.status IS 'Processing status: pending, processing, completed, or failed';
COMMENT ON COLUMN channel_queue.videos_processed IS 'Number of videos processed from this channel';