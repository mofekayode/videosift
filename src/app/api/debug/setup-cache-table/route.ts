import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🗃️ Setting up cache_entries table...');

    // Check if supabaseAdmin is available (it will be null in environments without the service role key)
    if (!supabaseAdmin) {
      console.log('⚠️ Supabase admin client not available - cannot set up cache table');
      return NextResponse.json({ message: 'Supabase admin client not available', error: 'Missing service role key' }, { status: 503 });
    }

    // Create cache_entries table
    const { error: tableError } = await supabaseAdmin.rpc('create_cache_table', {});
    
    if (tableError && !tableError.message.includes('already exists')) {
      console.error('Error creating cache table:', tableError);
      
      // Fallback: Create table with raw SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS cache_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          data JSONB NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
        CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
        CREATE INDEX IF NOT EXISTS idx_cache_entries_timestamp ON cache_entries(timestamp);

        -- Create RLS policies
        ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

        -- Policy to allow read access
        CREATE POLICY IF NOT EXISTS "Allow cache read access" 
        ON cache_entries FOR SELECT 
        USING (true);

        -- Policy to allow insert/update access  
        CREATE POLICY IF NOT EXISTS "Allow cache write access"
        ON cache_entries FOR ALL
        USING (true);
      `;

      const { error: rawError } = await supabaseAdmin.rpc('exec_sql', { 
        sql: createTableSQL 
      });

      if (rawError) {
        console.error('Raw SQL error:', rawError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create cache table',
          details: rawError
        }, { status: 500 });
      }
    }

    // Test table access
    const { data: testData, error: testError } = await supabaseAdmin
      .from('cache_entries')
      .select('count(*)')
      .limit(1);

    if (testError) {
      console.error('Table access test failed:', testError);
      return NextResponse.json({
        success: false,
        error: 'Cache table created but not accessible',
        details: testError
      }, { status: 500 });
    }

    console.log('✅ Cache table setup completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Cache table setup completed successfully',
      table_accessible: true
    });

  } catch (error) {
    console.error('Cache table setup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup cache table',
      details: error
    }, { status: 500 });
  }
}

// Manual table creation SQL for reference
export async function POST(request: NextRequest) {
  try {
    console.log('📂 Creating cache table with manual SQL...');
    
    // Check if supabaseAdmin is available (it will be null in environments without the service role key)
    if (!supabaseAdmin) {
      console.log('⚠️ Supabase admin client not available - cannot set up cache table');
      return NextResponse.json({ message: 'Supabase admin client not available', error: 'Missing service role key' }, { status: 503 });
    }

    // Execute direct SQL commands
    const commands = [
      `CREATE TABLE IF NOT EXISTS cache_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      `CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);`,
      `CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_cache_entries_timestamp ON cache_entries(timestamp);`,
      
      `ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;`,
      
      `DROP POLICY IF EXISTS "Allow cache read access" ON cache_entries;`,
      `CREATE POLICY "Allow cache read access" ON cache_entries FOR SELECT USING (true);`,
      
      `DROP POLICY IF EXISTS "Allow cache write access" ON cache_entries;`,  
      `CREATE POLICY "Allow cache write access" ON cache_entries FOR ALL USING (true);`
    ];

    for (const command of commands) {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: command });
      if (error && !error.message.includes('already exists')) {
        console.error(`SQL Command failed: ${command}`, error);
      }
    }

    // Test the table
    const { error: insertError } = await supabaseAdmin
      .from('cache_entries')
      .upsert({
        cache_key: 'test_key',
        data: { test: true },
        expires_at: new Date(Date.now() + 60000).toISOString()
      });

    if (insertError) {
      console.error('Test insert failed:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Table created but insert test failed',
        details: insertError
      }, { status: 500 });
    }

    // Cleanup test data
    await supabaseAdmin
      .from('cache_entries')
      .delete()
      .eq('cache_key', 'test_key');

    return NextResponse.json({
      success: true,
      message: 'Cache table created and tested successfully'
    });

  } catch (error) {
    console.error('Manual cache table creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create cache table manually',
      details: error
    }, { status: 500 });
  }
}