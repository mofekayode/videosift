import { NextRequest, NextResponse } from 'next/server';
import { processChannelQueue } from '@/lib/channel-processor';

export async function POST(request: NextRequest) {
  try {
    // This endpoint is for internal/cron job processing
    // In production, you'd want to authenticate this endpoint or call it from a secure environment
    
    const result = await processChannelQueue();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        processed: result.processed,
        channels: result.channels
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to process channel queue' 
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Channel queue processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}