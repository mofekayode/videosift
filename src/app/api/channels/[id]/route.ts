import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/user-sync';
import { cacheManager, CacheManager, CACHE_CONFIG } from '@/lib/cache';

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
    
    // Check cache first
    const cacheKey = `${CacheManager.channelDataKey(channelId)}:${user.id}`;
    const cachedData = await cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Channel data served from cache');
      return NextResponse.json({
        success: true,
        channel: cachedData,
        cached: true
      });
    }
    
    // Fetch channel details with ownership check and include videos
    const { data: channel, error } = await supabase
      .from('channels')
      .select(`
        *,
        videos!videos_channel_id_fkey (
          id,
          youtube_id,
          title,
          thumbnail_url,
          duration,
          chunks_processed
        )
      `)
      .eq('id', channelId)
      .eq('owner_user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching channel:', error);
      return NextResponse.json(
        { error: 'Channel not found' },
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