const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVideoChunks() {
  console.log('🔍 Checking video chunk status...\n');
  
  // Get videos from the new channel
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .eq('channel_id', 'b474e664-7e3e-4c3d-9c8a-6c16d8e707bc')
    .order('created_at', { ascending: false });
  
  console.log(`Found ${videos?.length || 0} videos:\n`);
  
  for (const video of (videos || [])) {
    console.log(`📹 ${video.title}`);
    console.log(`   YouTube ID: ${video.youtube_id}`);
    console.log(`   Transcript cached: ${video.transcript_cached}`);
    console.log(`   Chunks processed: ${video.chunks_processed}`);
    
    // Check if chunks exist
    const { count } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);
    
    console.log(`   Chunks in database: ${count || 0}`);
    console.log('');
  }
}

checkVideoChunks();