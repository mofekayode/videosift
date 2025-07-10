import { NextRequest, NextResponse } from 'next/server';
import { processAndCacheTranscript } from '@/lib/transcript';
import { getVideoByYouTubeId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    // Get video from database
    const video = await getVideoByYouTubeId(videoId);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found in database' },
        { status: 404 }
      );
    }
    
    // Check if transcript is already cached
    if (video.transcript_cached) {
      return NextResponse.json({
        success: true,
        message: 'Transcript already cached',
        cached: true
      });
    }
    
    // Process and cache transcript
    const success = await processAndCacheTranscript(
      video.youtube_id,
      video.id,
      video.channel_id || undefined
    );
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Transcript processed and cached successfully',
        cached: true
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to process transcript' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        cached: false
      },
      { status: 500 }
    );
  }
}