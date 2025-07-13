import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get all active processing channels with detailed progress
    const { data: activeChannels, error } = await supabaseAdmin
      .from('channel_queue')
      .select(`
        *,
        channels!inner (
          id,
          title,
          youtube_channel_id,
          status,
          video_count,
          total_video_count
        )
      `)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active channels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channel status' },
        { status: 500 }
      );
    }

    // Calculate progress and ETA for each channel
    const channelsWithProgress = (activeChannels || []).map((item: any) => {
      const progress = item.total_videos > 0 
        ? (item.videos_processed / item.total_videos) * 100 
        : 0;
      
      let estimatedTimeRemaining = null;
      if (item.started_at && item.videos_processed > 0 && item.total_videos > 0) {
        const elapsedMs = Date.now() - new Date(item.started_at).getTime();
        const avgTimePerVideo = elapsedMs / item.videos_processed;
        const remainingVideos = item.total_videos - item.videos_processed;
        estimatedTimeRemaining = Math.ceil((remainingVideos * avgTimePerVideo) / 1000); // in seconds
      }
      
      return {
        queueId: item.id,
        channelId: item.channels.id,
        channelTitle: item.channels.title,
        status: item.status,
        progress: Math.round(progress),
        videosProcessed: item.videos_processed || 0,
        totalVideos: item.total_videos || item.channels.total_video_count || 0,
        currentVideo: item.current_video_title,
        currentVideoIndex: item.current_video_index,
        estimatedTimeRemaining,
        estimatedCompletionAt: item.estimated_completion_at,
        startedAt: item.started_at,
        error: item.error_message
      };
    });

    return NextResponse.json({
      success: true,
      activeChannels: channelsWithProgress,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in channel monitor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}