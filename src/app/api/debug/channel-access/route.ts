import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
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

    // Get Supabase user
    const supabaseUser = await ensureUserExists();
    if (!supabaseUser) {
      return NextResponse.json({
        error: 'Failed to sync user data',
        clerkUserId,
        supabaseUser: null
      }, { status: 500 });
    }

    // Get channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({
        error: 'Channel not found',
        channelId,
        channelError
      }, { status: 404 });
    }

    // Check ownership
    const isOwner = channel.owner_user_id === supabaseUser.id;

    // Check queue access
    const { data: queueEntry, error: queueError } = await supabase
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .eq('requested_by', supabaseUser.id)
      .single();

    const hasQueueAccess = !queueError && queueEntry;

    return NextResponse.json({
      debug: {
        user: {
          clerkId: clerkUserId,
          supabaseId: supabaseUser.id,
          email: supabaseUser.email
        },
        channel: {
          id: channel.id,
          title: channel.title,
          ownerId: channel.owner_user_id,
          status: channel.status
        },
        access: {
          isOwner,
          hasQueueAccess,
          queueEntry: queueEntry || null,
          queueError: queueError?.message || null
        },
        accessGranted: isOwner || hasQueueAccess
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