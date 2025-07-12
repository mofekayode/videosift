import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUsageStats, getUserTier, getClientIP } from '@/lib/rate-limit';
import { ensureUserExists } from '@/lib/user-sync';

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
    
    // Get comprehensive usage statistics
    const stats = await getUsageStats(identifier, tier);
    
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