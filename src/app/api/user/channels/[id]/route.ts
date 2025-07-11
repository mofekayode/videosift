import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const channelId = params.id;

    // Verify the channel belongs to the user
    const { data: channel, error: fetchError } = await supabase
      .from('channels')
      .select('id, owner_user_id')
      .eq('id', channelId)
      .eq('owner_user_id', user.id)
      .single();

    if (fetchError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found or access denied' },
        { status: 404 }
      );
    }

    // Soft delete by setting owner_user_id to null
    // This makes the channel inaccessible to the user but preserves the data
    const { error: updateError } = await supabase
      .from('channels')
      .update({ 
        owner_user_id: null,
        // Add a deleted_by field if you want to track who deleted it
        metadata: {
          deleted_by: userId,
          deleted_at: new Date().toISOString()
        }
      })
      .eq('id', channelId);

    if (updateError) {
      console.error('Error soft-deleting channel:', updateError);
      return NextResponse.json(
        { error: 'Failed to delete channel' },
        { status: 500 }
      );
    }

    // Also remove from channel_queue if exists
    await supabase
      .from('channel_queue')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id);

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