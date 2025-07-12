// Script to run the rate_limits table migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running rate_limits table migration...');
  
  const migration = `
-- Create rate_limits table for tracking API usage
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_action ON rate_limits(action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(identifier, action, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique ON rate_limits(identifier, action, window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only (rate limiting should be server-side only)
CREATE POLICY "Service role can manage rate limits" ON rate_limits
  FOR ALL USING (auth.role() = 'service_role');
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: migration });
    
    if (error) {
      // If the RPC doesn't exist, try running individual statements
      console.log('RPC exec_sql not available, trying direct approach...');
      
      // Check if table exists first
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'rate_limits');
      
      if (tables && tables.length > 0) {
        console.log('✅ rate_limits table already exists');
      } else {
        console.error('❌ Cannot create table via API. Please run the migration SQL directly in Supabase dashboard.');
        console.log('\nCopy and paste this SQL in your Supabase SQL editor:\n');
        console.log(migration);
      }
    } else {
      console.log('✅ Migration completed successfully');
    }
  } catch (error) {
    console.error('Error running migration:', error);
    console.log('\nPlease run this SQL directly in your Supabase dashboard:\n');
    console.log(migration);
  }
}

runMigration();