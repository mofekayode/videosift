const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('Applying channel progress tracking migration...\n');
  
  const migration = `
-- Add progress tracking columns to channel_queue
ALTER TABLE channel_queue 
ADD COLUMN IF NOT EXISTS total_videos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_video_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_video_title TEXT,
ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMPTZ;

-- Add video count to channels table if not exists
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS total_video_count INTEGER DEFAULT 0;
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: migration });
    
    if (error) {
      console.error('Migration failed:', error);
    } else {
      console.log('✅ Migration applied successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

applyMigration();