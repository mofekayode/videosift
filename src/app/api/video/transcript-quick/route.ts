import { NextRequest, NextResponse } from 'next/server';
import { downloadTranscript } from '@/lib/transcript';
import { getVideoByYouTubeId, updateVideoTranscriptStatus } from '@/lib/database';
import { processTranscriptWithChunks } from '@/lib/transcript-processor';

// Quick transcript processing - download and upload to OpenAI vector store
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
    
    // Check if transcript is already processed with chunks
    if (video.transcript_cached && video.chunks_processed) {
      console.log('✅ Transcript already processed');
      return NextResponse.json({
        success: true,
        message: 'Transcript already processed',
        cached: true,
        chunksProcessed: true
      });
    }
    
    // If transcript is cached but not processed with chunks, re-process it
    if (video.transcript_cached && !video.chunks_processed) {
      console.log('⚠️ Legacy cached transcript without chunks, re-processing...');
    }
    
    // Download transcript with retry
    let segments;
    let downloadError;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📥 Downloading transcript (attempt ${attempt}/2)...`);
        segments = await downloadTranscript(videoId);
        console.log(`📊 Downloaded ${segments.length} transcript segments`);
        break; // Success, exit loop
      } catch (error) {
        downloadError = error;
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === 1) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // If download failed after retries, return error
    if (!segments) {
      console.error('❌ Failed to download transcript after retries');
      return NextResponse.json({
        success: false,
        error: downloadError instanceof Error ? downloadError.message : 'Failed to download transcript',
        details: 'Please try again. Some videos may not have captions available.'
      }, { status: 400 });
    }
    
    // Process transcript with semantic chunking system
    try {
      console.log('🚀 Processing transcript with semantic chunks...');
      const result = await processTranscriptWithChunks(video.id, segments);
      console.log(`✅ Processed ${result.chunkCount} chunks`);
      
      return NextResponse.json({
        success: true,
        message: 'Transcript processed with semantic chunks',
        cached: true,
        chunksProcessed: true,
        chunkCount: result.chunkCount
      });
    } catch (chunkError) {
      console.error('Failed to process transcript chunks:', chunkError);
      return NextResponse.json({
        success: false,
        error: 'Failed to process transcript',
        details: chunkError instanceof Error ? chunkError.message : 'Unknown error'
      }, { status: 500 });
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

