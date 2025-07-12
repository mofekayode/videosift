-- Add vector_store_id and file_id columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS vector_store_id TEXT,
ADD COLUMN IF NOT EXISTS file_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_videos_vector_store_id ON videos(vector_store_id);