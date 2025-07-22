import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get all channels
    const { data: allChannels, error: allError } = await supabase
      .from('channels')
      .select('id, title, youtube_channel_id, original_owner_id, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10);
      
    // Get user_channels for this user
    const { data: userRelations, error: relError } = await supabase
      .from('user_channels')
      .select('channel_id, created_at')
      .eq('user_id', user.id);
      
    // Get channels with this user as original owner
    const { data: ownedChannels, error: ownedError } = await supabase
      .from('channels')
      .select('id, title, youtube_channel_id')
      .eq('original_owner_id', user.id);
    
    return NextResponse.json({
      success: true,
      debug: {
        currentUser: {
          clerkId: userId,
          supabaseId: user.id,
          email: user.email
        },
        allChannels: {
          count: allChannels?.length || 0,
          channels: allChannels || [],
          error: allError?.message
        },
        userRelations: {
          count: userRelations?.length || 0,
          relations: userRelations || [],
          error: relError?.message
        },
        ownedChannels: {
          count: ownedChannels?.length || 0,
          channels: ownedChannels || [],
          error: ownedError?.message
        }
      }
    });
    
  } catch (error) {
    console.error('Error in debug-channels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}