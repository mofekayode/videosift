import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/services/youtube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  
  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    const metadata = await getVideoMetadata(videoId);
    
    if (!metadata) {
      return NextResponse.json(
        { error: 'Video not found or API error' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('YouTube API test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}