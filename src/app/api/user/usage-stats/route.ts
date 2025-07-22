import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserTier, getClientIP, QUOTA_CONFIG } from '@/lib/rate-limit';
import { ensureUserExists } from '@/lib/user-sync';
import { checkRateLimitSimple } from '@/lib/rate-limit-simple';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Get the Supabase user ID if authenticated
    let supabaseUserId = null;
    if (userId) {
      const user = await ensureUserExists();
      if (user) {
        supabaseUserId = user.id;
      }
    }
    
    // Get identifier (Supabase UUID or IP for anonymous users)
    const identifier = supabaseUserId || getClientIP(request);
    
    // Determine user tier
    const tier = getUserTier(userId);
    
    console.log('📊 Fetching usage stats for:', { identifier, tier });
    
    // Use the simple rate limit check that works with the actual database structure
    const [chatHourly, chatDaily] = await Promise.all([
      checkRateLimitSimple(identifier, 'chat', tier, 'hour'),
      checkRateLimitSimple(identifier, 'chat', tier, 'day')
    ]);
    
    // For other limits, just return the configured values
    const config = QUOTA_CONFIG[tier];
    
    const stats = {
      chat: { 
        hourly: chatHourly, 
        daily: chatDaily 
      },
      videoUpload: {
        allowed: true,
        limit: config.video_uploads_per_day || 10,
        remaining: config.video_uploads_per_day || 10,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    };
    
    return NextResponse.json({
      success: true,
      stats,
      tier,
      identifier: userId ? 'user' : 'anonymous'
    });
    
  } catch (error) {
    console.error('❌ Error fetching usage stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}