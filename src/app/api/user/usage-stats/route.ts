import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUsageStats, getUserTier, getClientIP } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Get identifier (userId or IP for anonymous users)
    const identifier = userId || getClientIP(request);
    
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