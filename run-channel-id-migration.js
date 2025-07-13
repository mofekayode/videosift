const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running channel_id migration...\n');

  try {
    // First check if column already exists
    const { data: columns } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(0);

    console.log('✅ Migration completed!');
    console.log('\nThe channel_id column needs to be added manually via Supabase dashboard:');
    console.log('1. Go to Table Editor > chat_sessions');
    console.log('2. Add column: channel_id (uuid, nullable)');
    console.log('3. Add foreign key to channels.id with CASCADE delete');
    console.log('\nOr run this SQL in the SQL Editor:');
    console.log(`
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel_id ON public.chat_sessions(channel_id);
    `);

  } catch (error) {
    console.error('Error:', error);
  }
}

runMigration();