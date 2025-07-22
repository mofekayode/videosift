import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';
import { cacheManager, CacheManager, CACHE_CONFIG } from '@/lib/cache';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const channelId = id;
    
    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check cache first
    const cacheKey = `${CacheManager.channelDataKey(channelId)}:${user.id}`;
    const cachedData = await cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Channel data served from cache');
      // Still verify access even with cached data - use admin client
      const { data: userChannelAccess } = await supabaseAdmin
        .from('user_channels')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();
      
      if (!userChannelAccess) {
        // Clear invalid cache
        await cacheManager.delete(cacheKey);
        return NextResponse.json(
          { error: 'Channel not found or access denied' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        channel: cachedData,
        cached: true
      });
    }
    
    // First check if channel exists
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select(`
        *,
        videos!videos_channel_id_fkey (
          id,
          youtube_id,
          title,
          thumbnail_url,
          duration,
          chunks_processed,
          transcript_cached
        )
      `)
      .eq('id', channelId)
      .single();
    
    if (channelError || !channel) {
      console.error('Channel not found:', channelError);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the channel via user_channels table - use admin client
    const { data: userChannelAccess, error: accessError } = await supabaseAdmin
      .from('user_channels')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();
    
    if (accessError || !userChannelAccess) {
      console.error('User does not have access to this channel');
      console.error('Access check details:', { 
        channelId, 
        userId: user.id, 
        accessError: accessError?.message || 'No error, but no access found',
        userEmail: user.email
      });
      
      // Double-check by listing all user's channel access with admin client
      const { data: allUserChannels } = await supabaseAdmin
        .from('user_channels')
        .select('channel_id')
        .eq('user_id', user.id);
      
      console.error('User\'s channel access list (admin):', allUserChannels);
      
      return NextResponse.json(
        { error: 'Channel not found or access denied' },
        { status: 404 }
      );
    }
    
    // Cache the result
    await cacheManager.set(cacheKey, channel, CACHE_CONFIG.channel_data);
    
    return NextResponse.json({
      success: true,
      channel,
      cached: false
    });
    
  } catch (error) {
    console.error('❌ Error fetching channel details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}