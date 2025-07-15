import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { processChannelQueue } from '@/lib/channel-processor';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('🚀 Manually triggering channel queue processing...');
    
    // Process the channel queue
    const result = await processChannelQueue();
    
    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ Error processing channel queue:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process channel queue',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}