import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const channelId = 'UCjm_qVkCPjOVDz9BWjNqO9A'; // Exponent
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  console.log('🔍 Testing YouTube API from server...');
  console.log('API Key present:', !!apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'YOUTUBE_API_KEY not found in environment',
      env: Object.keys(process.env).filter(k => k.includes('YOUTUBE')),
    });
  }
  
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=3` +
      `&key=${apiKey}`;
    
    console.log('Fetching:', url.substring(0, 100) + '...');
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response OK:', response.ok);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'YouTube API error',
        details: data.error,
        status: response.status
      });
    }
    
    return NextResponse.json({
      success: true,
      videosFound: data.items?.length || 0,
      videos: data.items?.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt
      })),
      apiKeyWorking: true
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Fetch failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}