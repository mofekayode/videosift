import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const channelId = 'UCjm_qVkCPjOVDz9BWjNqO9A'; // Exponent
  
  try {
    console.log('🔍 Testing fetchAllChannelVideos...');
    
    // Copy the exact function from process-queue
    const videos: any[] = [];
    let nextPageToken = '';
    const TEST_MODE = true;
    const TEST_VIDEO_LIMIT = 3;
    
    do {
      const url = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${TEST_MODE ? TEST_VIDEO_LIMIT : 50}` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : '') +
        `&key=${process.env.YOUTUBE_API_KEY}`;
      
      console.log(`🌐 Fetching from YouTube...`);
      console.log(`URL: ${url.substring(0, 100)}...`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`📡 YouTube API Response: status=${response.status}, ok=${response.ok}`);
      
      if (!response.ok) {
        console.error('❌ YouTube API Error:', data.error);
        return NextResponse.json({ 
          error: 'YouTube API error',
          details: data.error,
          apiKeyPresent: !!process.env.YOUTUBE_API_KEY
        });
      }
      
      if (!data.items) {
        console.log('⚠️ No items in response:', data);
      }
      
      videos.push(...(data.items || []));
      nextPageToken = data.nextPageToken || '';
      
      console.log(`📄 Fetched ${data.items?.length || 0} videos (total: ${videos.length})`);
      
      if (TEST_MODE && videos.length >= TEST_VIDEO_LIMIT) {
        console.log(`🧪 TEST MODE: Limiting to ${TEST_VIDEO_LIMIT} videos`);
        break;
      }
      
    } while (nextPageToken && (!TEST_MODE || videos.length < TEST_VIDEO_LIMIT));
    
    return NextResponse.json({
      success: true,
      videosFound: videos.length,
      videos: videos.map(v => ({
        id: v.id.videoId,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt
      })),
      testMode: TEST_MODE,
      limit: TEST_VIDEO_LIMIT
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Fetch failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}