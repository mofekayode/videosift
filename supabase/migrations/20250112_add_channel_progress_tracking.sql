-- Add progress tracking columns to channel_queue
ALTER TABLE channel_queue 
ADD COLUMN IF NOT EXISTS total_videos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_video_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_video_title TEXT,
ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMPTZ;

-- Add video count to channels table if not exists
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS total_video_count INTEGER DEFAULT 0;

-- Create function to calculate estimated completion time
CREATE OR REPLACE FUNCTION calculate_channel_eta(
  p_started_at TIMESTAMPTZ,
  p_videos_processed INTEGER,
  p_total_videos INTEGER
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  elapsed_seconds NUMERIC;
  avg_seconds_per_video NUMERIC;
  remaining_videos INTEGER;
  estimated_remaining_seconds NUMERIC;
BEGIN
  -- If not started or no videos processed, return null
  IF p_started_at IS NULL OR p_videos_processed = 0 OR p_total_videos = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate elapsed time
  elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - p_started_at));
  
  -- Calculate average time per video
  avg_seconds_per_video := elapsed_seconds / p_videos_processed;
  
  -- Calculate remaining videos
  remaining_videos := p_total_videos - p_videos_processed;
  
  -- If no remaining videos, processing is done
  IF remaining_videos <= 0 THEN
    RETURN NOW();
  END IF;
  
  -- Estimate remaining time (with a minimum of 10 seconds per video)
  avg_seconds_per_video := GREATEST(avg_seconds_per_video, 10);
  estimated_remaining_seconds := remaining_videos * avg_seconds_per_video;
  
  -- Return estimated completion time
  RETURN NOW() + (estimated_remaining_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION calculate_channel_eta IS 'Calculates estimated completion time for channel processing based on current progress';