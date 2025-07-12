-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create transcript_chunks table for RAG (only metadata, NOT the actual text)
CREATE TABLE transcript_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  
  -- Storage references (NOT the actual text)
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  byte_offset INTEGER NOT NULL, -- Where this chunk starts in the file
  byte_length INTEGER NOT NULL, -- How many bytes to read
  
  -- Embedding for similarity search
  embedding vector(1536), -- OpenAI embeddings dimension
  
  -- Metadata for better retrieval (extracted during processing)
  keywords TEXT[], -- Important keywords for hybrid search
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique chunks per video
  UNIQUE(video_id, chunk_index)
);

-- Create indexes for fast retrieval
CREATE INDEX idx_chunks_video_id ON transcript_chunks(video_id);
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_keywords ON transcript_chunks USING GIN (keywords);
CREATE INDEX idx_chunks_entities ON transcript_chunks USING GIN (entities);
CREATE INDEX idx_chunks_time ON transcript_chunks(video_id, start_time);

-- Function to search chunks by similarity
CREATE OR REPLACE FUNCTION search_transcript_chunks(
  query_embedding vector(1536),
  target_video_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  video_id UUID,
  chunk_index INTEGER,
  start_time FLOAT,
  end_time FLOAT,
  text TEXT,
  context_before TEXT,
  context_after TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.video_id,
    tc.chunk_index,
    tc.start_time,
    tc.end_time,
    tc.text,
    tc.context_before,
    tc.context_after,
    1 - (tc.embedding <=> query_embedding) as similarity
  FROM transcript_chunks tc
  WHERE tc.video_id = target_video_id
    AND tc.embedding IS NOT NULL
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search by keywords
CREATE OR REPLACE FUNCTION search_chunks_by_keywords(
  search_keywords TEXT[],
  target_video_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  video_id UUID,
  chunk_index INTEGER,
  start_time FLOAT,
  end_time FLOAT,
  text TEXT,
  keyword_matches INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.video_id,
    tc.chunk_index,
    tc.start_time,
    tc.end_time,
    tc.text,
    CARDINALITY(tc.keywords & search_keywords) as keyword_matches
  FROM transcript_chunks tc
  WHERE tc.video_id = target_video_id
    AND tc.keywords && search_keywords -- Has any of the keywords
  ORDER BY CARDINALITY(tc.keywords & search_keywords) DESC
  LIMIT match_count;
END;
$$;

-- Add transcript storage info to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS transcript_storage_path TEXT,
ADD COLUMN IF NOT EXISTS chunks_processed BOOLEAN DEFAULT FALSE;

-- Create storage bucket for transcripts if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('transcripts', 'transcripts', false)
ON CONFLICT (id) DO NOTHING;