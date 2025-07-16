import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Get queue status
    const { data: pending } = await supabaseAdmin
      .from('channel_queue')
      .select('id, created_at')
      .eq('status', 'pending');

    const { data: processing } = await supabaseAdmin
      .from('channel_queue')
      .select('id, started_at')
      .eq('status', 'processing');

    const { data: recent } = await supabaseAdmin
      .from('channel_queue')
      .select('id, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: 'healthy',
      queue: {
        pending: pending?.length || 0,
        processing: processing?.length || 0,
        recentlyCompleted: recent?.length || 0,
        lastCompleted: recent?.[0]?.completed_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}