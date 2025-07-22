-- Check the channel status and video count
SELECT 
  id,
  youtube_channel_id,
  title,
  status,
  video_count,
  created_at
FROM channels 
WHERE id = '951acaa9-d442-4255-94e8-34be4d6937fa';

-- Check if this channel has any videos
SELECT COUNT(*) as video_count
FROM videos
WHERE channel_id = '951acaa9-d442-4255-94e8-34be4d6937fa';