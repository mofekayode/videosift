import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Try to insert a test record to see what columns exist
    const testRecord = {
      identifier: 'test-user',
      action: 'test',
      count: 1,
      window_start: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };
    
    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert(testRecord);
    
    // Get all records to see structure
    const { data: allRecords, error: selectError } = await supabaseAdmin
      .from('rate_limits')
      .select('*');
    
    // Try with created_at instead of window_start
    const { data: recordsWithCreatedAt, error: createdAtError } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());
    
    // Clean up test record
    if (!insertError) {
      await supabaseAdmin
        .from('rate_limits')
        .delete()
        .eq('identifier', 'test-user');
    }
    
    return NextResponse.json({
      success: true,
      insertTest: {
        attempted: true,
        error: insertError?.message,
        errorDetails: insertError
      },
      records: {
        all: allRecords,
        count: allRecords?.length || 0,
        selectError: selectError?.message
      },
      tableStructure: {
        recordKeys: allRecords && allRecords.length > 0 ? Object.keys(allRecords[0]) : [],
        sampleRecord: allRecords && allRecords.length > 0 ? allRecords[0] : null
      }
    });
    
  } catch (error) {
    console.error('Error checking rate limits table:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}