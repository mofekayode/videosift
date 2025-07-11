import { NextRequest, NextResponse } from 'next/server';
import { downloadTranscript } from '@/lib/transcript';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || 'dQw4w9WgXcQ'; // Default to a known video
  
  try {
    console.log(`🔍 Testing transcript fetch for video: ${videoId}`);
    
    console.log('✅ API structure confirmed - testing transcript download...');
    
    // Test the downloadTranscript function
    const transcript = await downloadTranscript(videoId);
    
    console.log(`✅ Successfully fetched ${transcript.length} transcript segments`);
    
    if (transcript.length === 0) {
      console.log('⚠️ No transcript segments found - video may not have captions');
    } else {
      console.log('📝 First segment:', transcript[0]);
    }
    
    return NextResponse.json({
      success: true,
      videoId,
      segmentCount: transcript.length,
      firstSegment: transcript[0] || null,
      message: transcript.length === 0 ? 'No transcript available - video may not have captions' : 'Transcript fetched successfully',
      allSegments: transcript.length > 0 ? transcript.slice(0, 3) : [] // Show first 3 segments for debugging
    });
  } catch (error) {
    console.error('❌ Transcript fetch error:', error);
    console.error('Error type:', typeof error);
    console.error('Error stack:', error instanceof Error ? error.stack : null);
    
    return NextResponse.json({
      success: false,
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      rawError: String(error)
    }, { status: 500 });
  }
}