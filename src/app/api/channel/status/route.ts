import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    
    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required' },
        { status: 400 }
      );
    }

    // Ensure user exists in Supabase
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    // Get channel details with video count and queue status
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select(`
        *,
        channel_queue!channel_queue_channel_id_fkey (
          id,
          status,
          videos_processed,
          total_videos,
          current_video_index,
          current_video_title,
          error_message,
          started_at,
          completed_at
        )
      `)
      .eq('id', channelId)
      .single();
    
    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Count actual videos in the channel
    const { count: actualVideoCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    // Count videos with transcripts
    const { count: videosWithTranscripts } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('transcript_cached', true);

    // Get recent processing logs
    const { data: processingHistory } = await supabase
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .order('requested_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      channel: {
        ...channel,
        actualVideoCount,
        videosWithTranscripts,
        processingHistory,
        transparency: {
          expectedVideos: channel.total_video_count || 20,
          actualVideosInDB: actualVideoCount || 0,
          videosWithTranscripts: videosWithTranscripts || 0,
          displayedCount: channel.video_count || 0,
          status: channel.status,
          lastProcessingAttempt: processingHistory?.[0] || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching channel status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch channel status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}