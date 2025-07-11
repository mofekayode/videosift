import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/services/youtube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || 'dQw4w9WgXcQ'; // Default to a known video
  
  try {
    console.log(`🔍 Testing YouTube API for video: ${videoId}`);
    
    // Test the YouTube API
    const metadata = await getVideoMetadata(videoId);
    
    if (!metadata) {
      throw new Error('No metadata returned from YouTube API');
    }
    
    console.log(`✅ Successfully fetched metadata for: ${metadata.title}`);
    
    return NextResponse.json({
      success: true,
      videoId,
      metadata,
      message: 'YouTube API working correctly'
    });
  } catch (error) {
    console.error('❌ YouTube API error:', error);
    
    return NextResponse.json({
      success: false,
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}