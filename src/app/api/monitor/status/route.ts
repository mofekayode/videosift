import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();
    
    // Optional: Add authentication check
    // For now, let's make it public for monitoring
    
    // Get queue counts by status
    const { data: queueStats } = await supabaseAdmin
      .from('channel_queue')
      .select('status');
    
    const queueCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    queueStats?.forEach(item => {
      if (item.status in queueCounts) {
        queueCounts[item.status as keyof typeof queueCounts]++;
      }
    });

    // Get last completed channel
    const { data: lastCompleted } = await supabaseAdmin
      .from('channel_queue')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    // Get last failed channel
    const { data: lastFailed } = await supabaseAdmin
      .from('channel_queue')
      .select('completed_at')
      .eq('status', 'failed')
      .order('completed_at', { ascending: false })
      .limit(1);

    // Get recent channels with details
    const { data: recentChannels } = await supabaseAdmin
      .from('channel_queue')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        error_message,
        channels (
          title
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Format the data
    const formattedChannels = recentChannels?.map(item => ({
      id: item.id,
      title: item.channels?.title || 'Unknown Channel',
      status: item.status,
      created_at: item.created_at,
      completed_at: item.completed_at,
      error_message: item.error_message
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        queue: queueCounts,
        lastCompleted: lastCompleted?.[0]?.completed_at || null,
        lastFailed: lastFailed?.[0]?.completed_at || null,
        recentChannels: formattedChannels
      }
    });
    
  } catch (error) {
    console.error('Monitor status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}