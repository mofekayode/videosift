import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the Supabase user
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all user's channels with queue status
    const { data: channels, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_queue (
          id,
          status,
          started_at,
          completed_at,
          error_message,
          videos_processed,
          created_at,
          updated_at
        )
      `)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching channel status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channel status' },
        { status: 500 }
      );
    }

    // Get video counts for each channel
    const channelsWithDetails = await Promise.all(
      (channels || []).map(async (channel) => {
        const { count: videoCount } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channel.id)
          .eq('chunks_processed', true);

        return {
          ...channel,
          processed_video_count: videoCount || 0,
          queue_status: channel.channel_queue?.[0] || null
        };
      })
    );

    return NextResponse.json({
      success: true,
      channels: channelsWithDetails
    });

  } catch (error) {
    console.error('Error in channel status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}