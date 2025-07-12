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
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250112_create_channel_queue.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Creating channel_queue table...');
    console.log('\nPlease run the following SQL in your Supabase SQL Editor:\n');
    console.log('--- COPY FROM HERE ---\n');
    console.log(migrationSQL);
    console.log('\n--- COPY TO HERE ---\n');
    
    console.log('After running the SQL, channels feature will work properly!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

applyMigration();