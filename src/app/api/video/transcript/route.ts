import { NextRequest, NextResponse } from 'next/server';
import { processVideoTranscript } from '@/lib/process-video-transcript';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    console.log('📝 Processing transcript request for video:', videoId);
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    // Process video transcript with chunks
    const result = await processVideoTranscript(videoId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || 'Transcript processed successfully',
        cached: result.cached || false,
        chunkCount: result.chunkCount
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to process transcript' },
        { status: result.error?.includes('not found') ? 404 : 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Transcript API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      type: typeof error
    });
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        cached: false
      },
      { status: 500 }
    );
  }
}