import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

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

    // Get channel details
    const { data: channel } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();

    // Count actual videos
    const { count: totalVideos } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    // Count videos with transcripts
    const { count: videosWithTranscripts } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('transcript_cached', true);

    // Get all videos to see details
    const { data: allVideos } = await supabase
      .from('videos')
      .select('id, youtube_id, title, transcript_cached, chunks_processed, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    // Get processing history
    const { data: queueHistory } = await supabase
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .order('requested_at', { ascending: false });

    // Fetch fresh count from YouTube API
    let youtubeVideoCount = 0;
    if (channel?.youtube_channel_id) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.youtube_channel_id}&key=${process.env.YOUTUBE_API_KEY}`
        );
        if (response.ok) {
          const data = await response.json();
          youtubeVideoCount = parseInt(data.items?.[0]?.statistics?.videoCount || '0');
        }
      } catch (error) {
        console.error('Failed to fetch YouTube stats:', error);
      }
    }

    return NextResponse.json({
      channel: {
        id: channel?.id,
        title: channel?.title,
        youtube_channel_id: channel?.youtube_channel_id,
        status: channel?.status,
        video_count: channel?.video_count,
        total_video_count: channel?.total_video_count,
        created_at: channel?.created_at,
        last_indexed_at: channel?.last_indexed_at
      },
      counts: {
        displayedInDashboard: channel?.video_count || 0,
        actualVideosInDB: totalVideos || 0,
        videosWithTranscripts: videosWithTranscripts || 0,
        expectedFromChannel: channel?.total_video_count || 0,
        actualFromYouTubeAPI: youtubeVideoCount
      },
      videos: {
        total: allVideos?.length || 0,
        withTranscripts: allVideos?.filter(v => v.transcript_cached).length || 0,
        withoutTranscripts: allVideos?.filter(v => !v.transcript_cached).length || 0,
        processed: allVideos?.filter(v => v.chunks_processed).length || 0,
        list: allVideos?.slice(0, 30) // First 30 for debugging
      },
      processingHistory: queueHistory?.map(q => ({
        id: q.id,
        status: q.status,
        videos_processed: q.videos_processed,
        total_videos: q.total_videos,
        requested_at: q.requested_at,
        completed_at: q.completed_at,
        error_message: q.error_message
      }))
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