import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { channelUrl } = await request.json();
    
    // Extract channel ID from URL
    const channelIdMatch = channelUrl.match(/(?:youtube\.com\/(?:c\/|channel\/|@))([^\/\?]+)/);
    const channelIdentifier = channelIdMatch ? channelIdMatch[1] : null;
    
    if (!channelIdentifier) {
      return NextResponse.json(
        { error: 'Invalid channel URL' },
        { status: 400 }
      );
    }

    console.log('🔍 Debug: Fetching videos for channel:', channelIdentifier);
    
    // Test fetching videos with different parameters
    const videos: any[] = [];
    let nextPageToken = '';
    let pageCount = 0;
    
    do {
      pageCount++;
      const url = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelIdentifier}&type=video&order=date&maxResults=10` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : '') +
        `&key=${process.env.YOUTUBE_API_KEY}`;
      
      console.log(`📄 Fetching page ${pageCount}...`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ YouTube API Error:', data.error);
        return NextResponse.json({
          error: 'YouTube API error',
          details: data.error
        }, { status: 500 });
      }
      
      const pageVideos = data.items || [];
      videos.push(...pageVideos);
      nextPageToken = data.nextPageToken || '';
      
      console.log(`✅ Page ${pageCount}: Got ${pageVideos.length} videos, Total: ${videos.length}, Has next: ${!!nextPageToken}`);
      
      // Stop at 20 videos for testing
      if (videos.length >= 20) {
        console.log('🛑 Reached 20 video limit');
        break;
      }
      
    } while (nextPageToken);
    
    // Analyze the videos
    const videoAnalysis = videos.slice(0, 20).map((video, index) => ({
      index: index + 1,
      id: video.id.videoId,
      title: video.snippet.title,
      publishedAt: video.snippet.publishedAt,
      description: video.snippet.description?.substring(0, 100) + '...'
    }));
    
    return NextResponse.json({
      success: true,
      debug: {
        channelIdentifier,
        totalVideosFetched: videos.length,
        pagesNeeded: pageCount,
        limitedTo20: videos.length > 20,
        videos: videoAnalysis
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    
    return NextResponse.json(
      { 
        error: 'Debug failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}