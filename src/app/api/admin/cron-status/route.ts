import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Check if user is admin (you can add your user ID here)
    const ADMIN_USER_IDS = ['your-clerk-user-id'];
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent cron executions
    const { data: cronLogs } = await supabaseAdmin
      .from('cron_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    // Get channel queue status
    const { data: queueStatus } = await supabaseAdmin
      .from('channel_queue')
      .select('status')
      .in('status', ['pending', 'processing']);

    const pendingCount = queueStatus?.filter(q => q.status === 'pending').length || 0;
    const processingCount = queueStatus?.filter(q => q.status === 'processing').length || 0;

    // Get last successful run
    const { data: lastSuccess } = await supabaseAdmin
      .from('channel_queue')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        queue: {
          pending: pendingCount,
          processing: processingCount
        },
        lastSuccessfulRun: lastSuccess?.completed_at,
        recentRuns: cronLogs || [],
        nextRun: new Date(Date.now() + 60000).toISOString() // Next minute
      }
    });
    
  } catch (error) {
    console.error('Error fetching cron status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cron status' },
      { status: 500 }
    );
  }
}