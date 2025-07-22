import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
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
    
    console.log('🗑️ Removing channel access for user:', user.id, 'channel:', channelId);
    
    // Create Supabase client with service role for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Delete the user-channel relationship
    const { error: deleteError } = await supabase
      .from('user_channels')
      .delete()
      .eq('user_id', user.id)
      .eq('channel_id', channelId);
    
    if (deleteError) {
      console.error('❌ Error removing channel access:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove channel access' },
        { status: 500 }
      );
    }
    
    console.log('✅ Successfully removed channel access');
    
    return NextResponse.json({
      success: true,
      message: 'Channel access removed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in DELETE /api/user/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}