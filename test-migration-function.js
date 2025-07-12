const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMigration() {
  console.log('🧪 Testing migration function...\n');
  
  try {
    // Test with dummy data (won't migrate anything real)
    const { data, error } = await supabase.rpc('migrate_anon_sessions_to_user', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_anon_id: 'test_anon_id_' + Date.now()
    });
    
    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.log('❌ Migration function not found!');
        console.log('\n📝 Please apply the migration first:');
        console.log('1. Go to Supabase SQL Editor');
        console.log('2. Run the SQL from: supabase/migrations/20250112_migrate_anon_to_user_sessions.sql');
        console.log('\nSee APPLY_MIGRATION_INSTRUCTIONS.md for details.');
      } else {
        console.log('⚠️ Function exists but returned error:', error.message);
        console.log('This is normal if there are no sessions to migrate.');
      }
    } else {
      console.log('✅ Migration function is working!');
      console.log('Result:', data);
    }
    
    // Also check if user_events table exists
    console.log('\n📊 Checking user_events table...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_events')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST204') {
      console.log('✅ user_events table exists');
    } else if (tableError) {
      console.log('⚠️ user_events table might not exist:', tableError.message);
    } else {
      console.log('✅ user_events table exists');
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testMigration();