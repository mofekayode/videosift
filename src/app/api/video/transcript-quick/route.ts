import { NextRequest, NextResponse } from 'next/server';
import { processVideoTranscript } from '@/lib/process-video-transcript';

// Quick transcript processing - download and upload to OpenAI vector store
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoId = body.videoId;
    
    const result = await processVideoTranscript(videoId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        cached: result.cached,
        chunksProcessed: true,
        chunkCount: result.chunkCount
      });
    } else {
      // Determine appropriate status code
      let status = 500;
      if (result.error === 'Video ID is required') status = 400;
      else if (result.error === 'Video not found in database') status = 404;
      else if (result.error === 'Video is already being processed') status = 409;
      else if (result.error?.includes('Failed to download transcript')) status = 400;
      
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.error === 'Video is already being processed' 
          ? 'Please wait a moment and try again'
          : 'Please try again. Some videos may not have captions available.'
      }, { status });
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

