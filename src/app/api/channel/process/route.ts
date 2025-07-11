import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createChannel, queueChannel } from '@/lib/database';
import { extractChannelId } from '@/lib/youtube';

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
    
    if (!channelUrl) {
      return NextResponse.json(
        { error: 'Channel URL is required' },
        { status: 400 }
      );
    }

    console.log('🔗 Processing channel URL:', channelUrl);

    // Extract channel identifier from URL
    const channelIdentifier = extractChannelId(channelUrl);
    if (!channelIdentifier) {
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL' },
        { status: 400 }
      );
    }

    console.log('🔍 Channel identifier:', channelIdentifier);

    // Check if it's a direct channel ID or needs resolution
    let actualChannelId = channelIdentifier;
    let response;

    // If it's a direct channel ID (starts with UC), use it directly
    if (channelIdentifier.startsWith('UC') || channelIdentifier.startsWith('HC')) {
      response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdentifier}&key=${process.env.YOUTUBE_API_KEY}`
      );
    } else {
      // For custom URLs (@handle, /c/, /user/), we need to search for the channel
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelIdentifier)}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
      );
      
      if (!searchResponse.ok) {
        throw new Error('Failed to search for channel');
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        return NextResponse.json(
          { error: 'Channel not found' },
          { status: 404 }
        );
      }
      
      actualChannelId = searchData.items[0].id.channelId;
      console.log('🎯 Resolved channel ID:', actualChannelId);
      
      // Now fetch the full channel data
      response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${actualChannelId}&key=${process.env.YOUTUBE_API_KEY}`
      );
    }

    if (!response.ok) {
      throw new Error('Failed to fetch channel data from YouTube');
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    const channelData = data.items[0];
    
    // Create channel record in database
    const channel = await createChannel({
      youtube_channel_id: actualChannelId,
      title: channelData.snippet.title,
      owner_user_id: userId,
      status: 'pending'
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Failed to create channel record' },
        { status: 500 }
      );
    }

    // Queue the channel for processing
    const queueItem = await queueChannel(channel.id, userId);
    
    if (!queueItem) {
      return NextResponse.json(
        { error: 'Failed to queue channel for processing' },
        { status: 500 }
      );
    }

    console.log('✅ Channel queued for processing:', channel.title);

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        title: channel.title,
        youtube_channel_id: actualChannelId,
        status: channel.status,
        videoCount: channelData.statistics?.videoCount || 'Unknown'
      },
      queueItem: {
        id: queueItem.id,
        status: queueItem.status
      }
    });

  } catch (error) {
    console.error('❌ Channel processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}