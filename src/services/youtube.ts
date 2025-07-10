import { YouTubeMetadata, TranscriptSegment } from '@/types';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function getVideoMetadata(videoId: string): Promise<YouTubeMetadata | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata');
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }
    
    const video = data.items[0];
    const duration = parseDuration(video.contentDetails.duration);
    
    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      duration,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
      channel_title: video.snippet.channelTitle,
      channel_id: video.snippet.channelId,
    };
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return null;
  }
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    // Note: YouTube API doesn't provide transcript access directly
    // This would need to use a third-party service or the youtube-transcript library
    // For now, return empty array and implement later
    return [];
  } catch (error) {
    console.error('Error fetching video transcript:', error);
    return [];
  }
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration format (PT#M#S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}