import { NextRequest, NextResponse } from 'next/server';
import { downloadTranscript } from '@/lib/transcript';
import { getVideoByYouTubeId, createVideoChunksQuick, updateVideoTranscriptStatus } from '@/lib/database';

// Quick transcript processing - just download and chunk, no embeddings
export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    console.log('⚡ Quick transcript processing for video:', videoId);
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    // Get video from database
    const video = await getVideoByYouTubeId(videoId);
    
    if (!video) {
      console.log('❌ Video not found in database');
      return NextResponse.json(
        { error: 'Video not found in database' },
        { status: 404 }
      );
    }
    
    // Check if transcript is already cached
    if (video.transcript_cached) {
      console.log('✅ Transcript already cached');
      return NextResponse.json({
        success: true,
        message: 'Transcript already cached',
        cached: true
      });
    }
    
    // Download transcript quickly
    const segments = await downloadTranscript(videoId);
    
    // Create chunks without embeddings for immediate use
    const chunks = createTranscriptChunks(segments);
    console.log(`📦 Created ${chunks.length} transcript chunks`);
    
    // Save chunks to database WITHOUT embeddings (for quick access)
    const chunksWithoutEmbeddings = chunks.map(chunk => ({
      video_id: video.id,
      channel_id: video.channel_id || undefined,
      start_sec: chunk.start,
      end_sec: chunk.end,
      text: chunk.text,
      embedding: null // No embedding yet
    }));
    
    const success = await createVideoChunksQuick(chunksWithoutEmbeddings);
    
    if (success) {
      // Mark transcript as available (but not fully processed)
      await updateVideoTranscriptStatus(video.id, true);
      console.log(`⚡ Transcript made available quickly for video: ${videoId}`);
      
      // Trigger background embedding processing (fire and forget)
      fetch('/api/video/process-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      }).catch(error => console.log('Background embedding processing failed:', error));
      
      return NextResponse.json({
        success: true,
        message: 'Transcript available for chat, embeddings processing in background',
        cached: true
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to save transcript chunks' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Quick transcript API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        cached: false
      },
      { status: 500 }
    );
  }
}

function createTranscriptChunks(segments: Array<{start: number, end: number, text: string}>, targetLength: number = 200): Array<{start: number, end: number, text: string}> {
  const chunks: Array<{start: number, end: number, text: string}> = [];
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