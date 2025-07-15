import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const channelId = id;

    // Verify the user has access to this channel via queue
    const { data: queueEntry, error: fetchError } = await supabase
      .from('channel_queue')
      .select('*')
      .eq('channel_id', channelId)
      .eq('requested_by', user.id)
      .single();

    if (fetchError || !queueEntry) {
      return NextResponse.json(
        { error: 'Channel not found or access denied' },
        { status: 404 }
      );
    }

    // Remove user's access to the channel by deleting their queue entry
    // This preserves the channel and videos for other users who may have indexed it
    const { error: deleteError } = await supabase
      .from('channel_queue')
      .delete()
      .eq('channel_id', channelId)
      .eq('requested_by', user.id);

    if (deleteError) {
      console.error('Error removing channel access:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove channel access' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Channel removed successfully'
    });

  } catch (error) {
    console.error('Channel deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}