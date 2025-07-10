-- Vector search function for video chunks
CREATE OR REPLACE FUNCTION search_video_chunks(
  video_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  video_id UUID,
  channel_id UUID,
  start_sec INT,
  end_sec INT,
  text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    video_chunks.id,
    video_chunks.video_id,
    video_chunks.channel_id,
    video_chunks.start_sec,
    video_chunks.end_sec,
    video_chunks.text,
    1 - (video_chunks.embedding <=> query_embedding) AS similarity
  FROM video_chunks
  WHERE video_chunks.video_id = search_video_chunks.video_id
    AND 1 - (video_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY video_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector search function for channel chunks
CREATE OR REPLACE FUNCTION search_channel_chunks(
  channel_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  video_id UUID,
  channel_id UUID,
  start_sec INT,
  end_sec INT,
  text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    video_chunks.id,
    video_chunks.video_id,
    video_chunks.channel_id,
    video_chunks.start_sec,
    video_chunks.end_sec,
    video_chunks.text,
    1 - (video_chunks.embedding <=> query_embedding) AS similarity
  FROM video_chunks
  WHERE video_chunks.channel_id = search_channel_chunks.channel_id
    AND 1 - (video_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY video_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get channel statistics
CREATE OR REPLACE FUNCTION get_channel_stats(channel_id UUID)
RETURNS TABLE (
  video_count BIGINT,
  total_duration BIGINT,
  chunk_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(v.id) AS video_count,
    SUM(v.duration) AS total_duration,
    COUNT(vc.id) AS chunk_count
  FROM videos v
  LEFT JOIN video_chunks vc ON v.id = vc.video_id
  WHERE v.channel_id = get_channel_stats.channel_id;
END;
$$;

-- Function to update channel statistics
CREATE OR REPLACE FUNCTION update_channel_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update channel stats when videos are added/removed
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE channels
    SET 
      video_count = (
        SELECT COUNT(*) FROM videos WHERE channel_id = NEW.channel_id
      ),
      total_duration = (
        SELECT COALESCE(SUM(duration), 0) FROM videos WHERE channel_id = NEW.channel_id
      )
    WHERE id = NEW.channel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE channels
    SET 
      video_count = (
        SELECT COUNT(*) FROM videos WHERE channel_id = OLD.channel_id
      ),
      total_duration = (
        SELECT COALESCE(SUM(duration), 0) FROM videos WHERE channel_id = OLD.channel_id
      )
    WHERE id = OLD.channel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to automatically update channel stats
CREATE TRIGGER update_channel_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_stats();

-- Function to clean up old queue entries
CREATE OR REPLACE FUNCTION cleanup_old_queue_entries()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM channel_queue
  WHERE status IN ('completed', 'error')
    AND finished_at < NOW() - INTERVAL '7 days';
END;
$$;