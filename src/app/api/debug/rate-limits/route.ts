import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get all rate limit records
    const { data: rateLimits, error } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Check if table exists
    const { data: tables } = await supabaseAdmin
      .rpc('get_tables')
      .eq('table_name', 'rate_limits');
    
    return NextResponse.json({
      success: true,
      tableExists: !!tables?.length,
      recordCount: rateLimits?.length || 0,
      records: rateLimits || [],
      error: error?.message
    });
    
  } catch (error) {
    console.error('Error in debug-rate-limits:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}