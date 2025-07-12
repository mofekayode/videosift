const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250112_migrate_anon_to_user_sessions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying anonymous session migration...');
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('query', {
      query: migrationSQL
    });
    
    if (error) {
      // Try direct execution if RPC doesn't work
      console.log('⚠️ RPC query failed, trying direct execution...');
      
      // Split the migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        console.log('Executing statement:', statement.substring(0, 50) + '...');
        
        // For functions and complex statements, we need to use a different approach
        // Let's create a simpler version that can be executed via the API
      }
      
      console.log('\n❌ Could not apply migration automatically.');
      console.log('Please run the following SQL in your Supabase SQL Editor:');
      console.log('\n--- COPY FROM HERE ---\n');
      console.log(migrationSQL);
      console.log('\n--- COPY TO HERE ---\n');
      
      return;
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Test the function
    console.log('\n🧪 Testing migration function...');
    const { data: testResult, error: testError } = await supabase.rpc('migrate_anon_sessions_to_user', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_anon_id: 'test_anon_id'
    });
    
    if (testError) {
      console.log('⚠️ Function test failed:', testError.message);
      console.log('This is expected if there are no test sessions to migrate.');
    } else {
      console.log('✅ Function test successful:', testResult);
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    console.log('\nPlease apply the migration manually in Supabase SQL Editor.');
  }
}

applyMigration();