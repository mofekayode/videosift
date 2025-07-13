import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get channel (no ownership check - anyone can view videos from ready channels)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, youtube_channel_id, status')
      .eq('id', id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    // Only allow access to ready channels
    if (channel.status !== 'ready') {
      return NextResponse.json(
        { error: 'Channel is not ready yet' },
        { status: 403 }
      );
    }

    // Get all videos for this channel
    // Note: videos.channel_id references channels.id, not youtube_channel_id
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id, youtube_id, title, thumbnail_url, duration')
      .eq('channel_id', id)  // Use the Supabase channel ID
      .order('created_at', { ascending: false });

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videos: videos || []
    });
  } catch (error) {
    console.error('Error in channel videos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}