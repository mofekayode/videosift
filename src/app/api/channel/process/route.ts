import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createChannel, queueChannel, getUserByClerkId } from '@/lib/database';
import { extractChannelId } from '@/lib/youtube';
import { ensureUserExists } from '@/lib/user-sync';
import { checkRateLimit, getUserTier } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';

// Import the processing function
import { processChannelQueue } from '@/lib/channel-processor';

// Function to trigger channel processing in the background
async function triggerChannelProcessing() {
  try {
    console.log('🚀 Triggering automatic channel processing...');
    
    // Call the function directly - no HTTP request needed
    const result = await processChannelQueue();
    console.log('✅ Processing triggered:', result);
    
  } catch (error) {
    // Don't throw - this is a background task
    console.error('❌ Error triggering processing:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Ensure user exists in Supabase and get the Supabase user record
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    // Check channel quota
    const tier = getUserTier(userId);
    const channelLimit = tier === 'premium' ? 10 : 1; // 1 for beta users, 10 for premium
    
    // Count existing channels through user_channels table
    const { count: existingChannels, error: countError } = await supabaseAdmin
      .from('user_channels')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    if (countError) {
      console.error('Error counting channels:', countError);
      return NextResponse.json(
        { error: 'Failed to check channel quota' },
        { status: 500 }
      );
    }
    
    if ((existingChannels || 0) >= channelLimit) {
      return NextResponse.json(
        { 
          error: `You've reached your channel limit (${channelLimit}).Contact support to increase your limit.'}`,
          quotaExceeded: true,
          limit: channelLimit,
          used: existingChannels || 0
        },
        { status: 429 }
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
    console.log('🔍 Extracted channel identifier:', channelIdentifier);
    
    if (!channelIdentifier) {
      console.error('❌ Failed to extract channel ID from URL:', channelUrl);
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL. Please use a format like youtube.com/@channelname or youtube.com/channel/UCxxxxx' },
        { status: 400 }
      );
    }

    console.log('✅ Channel identifier:', channelIdentifier);

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
      console.log(`🔍 Searching for channel handle: ${channelIdentifier}`);
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelIdentifier)}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
      );
      
      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        console.error('❌ YouTube Search API Error:', errorData);
        throw new Error(`Failed to search for channel: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const searchData = await searchResponse.json();
      console.log('🔍 Search API Response:', JSON.stringify(searchData, null, 2));
      
      if (!searchData.items || searchData.items.length === 0) {
        console.error('❌ No channels found for identifier:', channelIdentifier);
        return NextResponse.json(
          { error: 'Channel not found. Please check the channel URL and try again.' },
          { status: 404 }
        );
      }
      
      // Validate the channel ID from search results
      const searchResult = searchData.items[0];
      if (!searchResult.id || !searchResult.id.channelId) {
        console.error('❌ Invalid search result structure:', searchResult);
        return NextResponse.json(
          { error: 'Invalid channel data received from YouTube' },
          { status: 500 }
        );
      }
      
      actualChannelId = searchResult.id.channelId;
      console.log('🎯 Resolved channel ID:', actualChannelId);
      
      // Validate the resolved channel ID format
      if (!actualChannelId.startsWith('UC') && !actualChannelId.startsWith('HC')) {
        console.error('❌ Invalid resolved channel ID format:', actualChannelId);
        return NextResponse.json(
          { error: 'Invalid YouTube channel ID resolved. Please contact support.' },
          { status: 500 }
        );
      }
      
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
    
    // Validate that we have a proper YouTube channel ID
    if (!actualChannelId || !actualChannelId.startsWith('UC')) {
      console.error('Invalid YouTube channel ID:', actualChannelId);
      return NextResponse.json(
        { error: 'Invalid YouTube channel ID resolved. Please check the URL and try again.' },
        { status: 400 }
      );
    }

    console.log('Creating channel with:', {
      youtube_channel_id: actualChannelId,
      title: channelData.snippet.title
    });

    // Create channel record in database
    const channel = await createChannel({
      youtube_channel_id: actualChannelId,
      title: channelData.snippet.title,
      owner_user_id: user.id,  // Use the Supabase user ID (UUID) instead of Clerk ID
      status: 'pending'
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Failed to create or retrieve channel record' },
        { status: 500 }
      );
    }

    // Check if channel is already processed and has videos
    if (channel.status === 'ready') {
      // Verify the channel actually has videos
      const { count: videoCount } = await supabaseAdmin
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.id);
      
      console.log(`Channel ${channel.title} has ${videoCount} videos`);
      
      if (!videoCount || videoCount === 0) {
        // Channel marked as ready but has no videos - reprocess it
        console.log('⚠️ Channel marked as ready but has no videos, reprocessing...');
        
        // Update channel status back to pending
        await supabaseAdmin
          .from('channels')
          .update({ status: 'pending' })
          .eq('id', channel.id);
        
        // Continue with normal processing flow
      } else {
        // Channel is truly ready with videos, just add user access
        const queueItem = await queueChannel(channel.id, user.id);
        
        if (!queueItem) {
          return NextResponse.json(
            { error: 'Failed to add channel access' },
            { status: 500 }
          );
        }

        console.log('✅ Channel already processed with videos, added user access:', channel.title);

        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          channel: {
            id: channel.id,
            title: channel.title,
            youtube_channel_id: actualChannelId,
            status: channel.status,
            videoCount: videoCount
          }
        });
      }
    }

    // Queue the channel for processing
    const queueItem = await queueChannel(channel.id, user.id);
    
    if (!queueItem) {
      return NextResponse.json(
        { error: 'Failed to queue channel for processing' },
        { status: 500 }
      );
    }

    console.log('✅ Channel queued for processing:', channel.title);

    // On Vercel, we rely on cron jobs instead of background processing
    // The cron job at /api/cron/process-channels will handle processing
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'development') {
      // Only trigger immediate processing in local development
      triggerChannelProcessing();
    }

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
    
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'details' in error ? (error as any).details : null;
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}