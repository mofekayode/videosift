import { YoutubeTranscript } from 'youtube-transcript';
import { generateEmbedding } from './openai';
import { createVideoChunks, updateVideoTranscriptStatus } from './database';
import { TranscriptSegment } from '@/types';

interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export async function downloadTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    console.log(`📥 Downloading transcript for video: ${videoId}`);
    
    // Get transcript from YouTube
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript available for this video');
    }
    
    // Convert to our format
    const segments: TranscriptSegment[] = transcript.map((item: TranscriptItem) => ({
      start: Math.floor(item.offset / 1000), // Convert ms to seconds
      end: Math.floor((item.offset + item.duration) / 1000),
      text: item.text.trim()
    }));
    
    console.log(`✅ Downloaded ${segments.length} transcript segments`);
    return segments;
    
  } catch (error) {
    console.error('Transcript download error:', error);
    throw new Error(`Failed to download transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function processAndCacheTranscript(
  videoId: string, 
  dbVideoId: string,
  channelId?: string
): Promise<boolean> {
  try {
    console.log(`🔄 Processing transcript for video: ${videoId}`);
    
    // Download transcript
    const segments = await downloadTranscript(videoId);
    
    // Create chunks (combine short segments for better context)
    const chunks = createTranscriptChunks(segments);
    console.log(`📦 Created ${chunks.length} transcript chunks`);
    
    // Generate embeddings and save to database
    const chunksWithEmbeddings = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🧠 Generating embedding for chunk ${i + 1}/${chunks.length}`);
      
      const embeddingResult = await generateEmbedding(chunk.text);
      
      if (embeddingResult) {
        chunksWithEmbeddings.push({
          video_id: dbVideoId,
          channel_id: channelId || null,
          start_sec: chunk.start,
          end_sec: chunk.end,
          text: chunk.text,
          embedding: embeddingResult.embedding
        });
      }
    }
    
    // Save chunks to database
    const success = await createVideoChunks(chunksWithEmbeddings);
    
    if (success) {
      // Mark transcript as cached
      await updateVideoTranscriptStatus(dbVideoId, true);
      console.log(`✅ Transcript cached successfully for video: ${videoId}`);
      return true;
    } else {
      throw new Error('Failed to save transcript chunks to database');
    }
    
  } catch (error) {
    console.error('Transcript processing error:', error);
    return false;
  }
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