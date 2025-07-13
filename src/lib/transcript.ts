import YoutubeTranscriptApi from 'youtube-transcript-api';
import { TranscriptSegment } from '@/types';

export async function downloadTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    console.log(`📥 Downloading transcript for video: ${videoId}`);
    
    // Get the transcript using the static method (v2.0.4 API)
    const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
    console.log('✅ Raw transcript received:', transcript ? `${transcript.length} segments` : 'null/undefined');
    
    if (!transcript || transcript.length === 0) {
      throw new Error('Unable to analyze this video. The video may not have captions enabled or may be private.');
    }
    
    console.log(`✅ Downloaded ${transcript.length} transcript segments`);
    
    // Convert to our format (matching your working code structure)
    const segments: TranscriptSegment[] = transcript.map((segment) => {
      const startTime = typeof segment.start === 'string' ? parseFloat(segment.start) : segment.start;
      const duration = typeof segment.duration === 'string' ? parseFloat(segment.duration) : segment.duration;
      
      return {
        start: Math.floor(startTime),
        end: Math.floor(startTime + duration),
        text: segment.text.trim()
      };
    });
    
    console.log(`✅ Converted ${segments.length} transcript segments`);
    return segments;
    
  } catch (error: any) {
    console.error('Transcript download error:', error);
    console.error('Error type:', typeof error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Provide more specific error messages
    if (error.message?.includes('Could not get transcript')) {
      throw new Error('This video cannot be analyzed. Only videos with captions enabled can be processed.');
    } else if (error.message?.includes('Video unavailable')) {
      throw new Error('This video is unavailable. It may be private, deleted, or restricted in your region.');
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
      throw new Error('Network error while downloading transcript. Please check your internet connection.');
    } else if (error.message?.includes('Too Many Requests')) {
      throw new Error('YouTube is temporarily blocking requests. Please try again in a few minutes.');
    }
    
    throw new Error(`Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// This function is deprecated - we now use OpenAI vector stores instead of local chunk storage
// Keeping for reference but should not be used
export async function processAndCacheTranscript(
  videoId: string, 
  dbVideoId: string,
  channelId?: string
): Promise<boolean> {
  console.warn('⚠️ processAndCacheTranscript is deprecated. Use OpenAI vector stores instead.');
  return false;
}

function createTranscriptChunks(segments: TranscriptSegment[], targetLength: number = 200): TranscriptSegment[] {
  const chunks: TranscriptSegment[] = [];
  let currentChunk = '';
  let chunkStart = 0;
  let chunkEnd = 0;
  
  for (const segment of segments) {
    // If adding this segment would exceed target length, save current chunk
    if (currentChunk.length + segment.text.length > targetLength && currentChunk.length > 0) {
      chunks.push({
        start: chunkStart,
        end: chunkEnd,
        text: currentChunk.trim()
      });
      
      // Start new chunk
      currentChunk = segment.text;
      chunkStart = segment.start;
      chunkEnd = segment.end;
    } else {
      // Add to current chunk
      if (currentChunk.length === 0) {
        chunkStart = segment.start;
      }
      
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + segment.text;
      chunkEnd = segment.end;
    }
  }
  
  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push({
      start: chunkStart,
      end: chunkEnd,
      text: currentChunk.trim()
    });
  }
  
  return chunks;
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format transcript segments for OpenAI vector store
export function formatTranscriptForVectorStore(segments: TranscriptSegment[]): string {
  return segments
    .map(segment => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join('\n');
}