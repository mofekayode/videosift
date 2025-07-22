import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserChannels } from '@/lib/database';
import { ensureUserExists } from '@/lib/user-sync';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    console.log('🔐 GET /api/user/channels - Clerk userId:', userId);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Ensure user exists in Supabase and get the Supabase user record
    const user = await ensureUserExists();
    if (!user) {
      console.error('❌ Failed to sync user data');
      return NextResponse.json(
        { error: 'Failed to sync user data' },
        { status: 500 }
      );
    }

    console.log('📋 Fetching channels for Supabase user:', user.id, 'email:', user.email);
    
    // Debug: Check user_channels table directly
    console.log('🔍 Debugging user_channels for user:', user.id);
    const { data: userChannelRelations, error: relError } = await supabaseAdmin
      .from('user_channels')
      .select('channel_id')
      .eq('user_id', user.id);
      
    if (relError) {
      console.error('❌ Error fetching user_channels:', relError);
    } else {
      console.log('✅ Found user_channels:', userChannelRelations);
    }
    
    const channels = await getUserChannels(user.id);
    
    console.log(`✅ Found ${channels.length} channels for user`);
    
    return NextResponse.json({
      success: true,
      channels
    });
    
  } catch (error) {
    console.error('❌ Error fetching user channels:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}