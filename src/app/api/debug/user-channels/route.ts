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

    // Ensure user exists in Supabase
    const user = await ensureUserExists();
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    // Get all channel_queue entries for this user
    const { data: queueEntries, error: queueError } = await supabase
      .from('channel_queue')
      .select(`
        *,
        channels (
          id,
          youtube_channel_id,
          title,
          status,
          video_count,
          owner_user_id
        )
      `)
      .eq('requested_by', user.id);

    // Also check if any channels are owned by this user
    const { data: ownedChannels, error: ownedError } = await supabase
      .from('channels')
      .select('*')
      .eq('owner_user_id', user.id);

    return NextResponse.json({
      user: {
        clerkId: userId,
        supabaseId: user.id,
        email: user.email
      },
      channelAccess: {
        viaQueue: queueEntries?.map(q => ({
          queueId: q.id,
          channelId: q.channel_id,
          channelTitle: q.channels?.title,
          channelStatus: q.channels?.status,
          queueStatus: q.status,
          requestedAt: q.requested_at
        })),
        asOwner: ownedChannels?.map(c => ({
          channelId: c.id,
          title: c.title,
          status: c.status,
          videoCount: c.video_count
        }))
      },
      totalChannels: (queueEntries?.length || 0) + (ownedChannels?.length || 0)
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