import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || 'dQw4w9WgXcQ';
  
  try {
    // Test basic YouTube API call
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key is not configured');
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`YouTube API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      videoId,
      hasItems: data.items && data.items.length > 0,
      title: data.items?.[0]?.snippet?.title || 'No title',
      apiKey: YOUTUBE_API_KEY ? 'Present' : 'Missing',
      message: 'YouTube API test successful'
    });
    
  } catch (error) {
    console.error('❌ Simple API test error:', error);
    
    return NextResponse.json({
      success: false,
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKey: process.env.YOUTUBE_API_KEY ? 'Present' : 'Missing'
    }, { status: 500 });
  }
}