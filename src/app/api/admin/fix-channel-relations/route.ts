import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserExists } from '@/lib/user-sync';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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
    
    // Find channels that were originally owned by this user but don't have user_channels relation
    const { data: orphanedChannels, error: channelsError } = await supabase
      .from('channels')
      .select('id, title, youtube_channel_id')
      .eq('original_owner_id', user.id);
      
    if (channelsError) {
      console.error('Error finding orphaned channels:', channelsError);
      return NextResponse.json(
        { error: 'Failed to find channels' },
        { status: 500 }
      );
    }
    
    console.log(`Found ${orphanedChannels?.length || 0} channels with original_owner_id = ${user.id}`);
    
    if (!orphanedChannels || orphanedChannels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned channels found',
        fixed: 0
      });
    }
    
    // Create user_channels relations for each orphaned channel
    let fixed = 0;
    for (const channel of orphanedChannels) {
      // Check if relation already exists
      const { data: existing } = await supabase
        .from('user_channels')
        .select('id')
        .eq('user_id', user.id)
        .eq('channel_id', channel.id)
        .single();
        
      if (!existing) {
        const { error: insertError } = await supabase
          .from('user_channels')
          .insert({
            user_id: user.id,
            channel_id: channel.id
          });
          
        if (insertError) {
          console.error(`Failed to create relation for channel ${channel.id}:`, insertError);
        } else {
          console.log(`Created user_channel relation for channel: ${channel.title}`);
          fixed++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed} channel relations`,
      fixed,
      total: orphanedChannels.length
    });
    
  } catch (error) {
    console.error('Error in fix-channel-relations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}