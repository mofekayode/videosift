import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserChannels } from '@/lib/database';
import { ensureUserExists } from '@/lib/user-sync';
import { createClient } from '@supabase/supabase-js';

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
    
    // Try using service role key directly for debugging
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔑 Using service role key for debugging');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Get user channels with admin client
      const { data: userChannelRelations, error: relError } = await supabaseAdmin
        .from('user_channels')
        .select('channel_id')
        .eq('user_id', user.id);
        
      if (relError) {
        console.error('❌ Admin client error fetching user_channels:', relError);
      } else {
        console.log('✅ Admin client found user_channels:', userChannelRelations);
      }
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