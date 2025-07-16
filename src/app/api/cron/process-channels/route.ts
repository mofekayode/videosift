import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { processChannelQueue } from '@/lib/channel-processor';

export async function GET(request: NextRequest) {
  try {
    // Verify this is from Vercel Cron (in production)
    if (process.env.NODE_ENV === 'production') {
      const authHeader = headers().get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('🔄 Cron job: Processing channel queue...');
    
    // Process the channel queue
    const result = await processChannelQueue();
    
    console.log('✅ Channel processing completed:', result);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} channels`,
      result
    });
    
  } catch (error) {
    console.error('❌ Channel processing cron error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process channels',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}