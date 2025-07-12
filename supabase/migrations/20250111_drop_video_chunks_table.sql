-- Drop video_chunks table as we're now using OpenAI vector stores
-- First drop any indexes
DROP INDEX IF EXISTS idx_video_chunks_video_id;
DROP INDEX IF EXISTS idx_video_chunks_channel_id;

-- Drop any RPC functions that use video_chunks
DROP FUNCTION IF EXISTS search_video_chunks;
DROP FUNCTION IF EXISTS search_channel_chunks;

-- Finally drop the table
DROP TABLE IF EXISTS video_chunks;

-- Also clean up any related functions
DROP FUNCTION IF EXISTS update_video_chunk_embeddings;
DROP FUNCTION IF EXISTS get_video_chunks_for_processing;