import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { processChannelQueue } from '@/lib/channel-processor';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Verify this is from Vercel Cron (in production)
    if (process.env.NODE_ENV === 'production') {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('🔄 Cron job: Processing channel queue at', new Date().toISOString());
    
    // Log to database for monitoring (optional - remove if table doesn't exist)
    try {
      await supabaseAdmin.from('cron_logs').insert({
        job_name: 'process-channels',
        started_at: new Date().toISOString(),
        status: 'running'
      });
    } catch (error) {
      // Ignore if table doesn't exist
      console.log('Note: cron_logs table not found, skipping logging');
    }
    
    // Process the channel queue
    const result = await processChannelQueue();
    
    console.log('✅ Channel processing completed:', {
      ...result,
      timestamp: new Date().toISOString()
    });
    
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