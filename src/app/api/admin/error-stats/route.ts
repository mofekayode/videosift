import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { errorTracker } from '@/lib/error-tracking';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // For now, only allow authenticated users to access error stats
    // In production, you'd want admin-level permissions
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as 'hour' | 'day' | 'week' || 'day';

    const stats = await errorTracker.getErrorStats(timeframe);

    return NextResponse.json({
      success: true,
      stats,
      timeframe
    });

  } catch (error) {
    console.error('Error fetching error stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}