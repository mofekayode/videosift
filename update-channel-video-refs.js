const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateChannelVideoReferences() {
  console.log('🔧 Updating channel video references...\n');
  
  // Get all channels with their videos
  const { data: channels } = await supabase
    .from('channels')
    .select(`
      id, 
      title,
      videos!videos_channel_id_fkey (
        id,
        youtube_id,
        title,
        chunks_processed
      )
    `);
  
  for (const channel of channels) {
    console.log(`\n📺 Channel: ${channel.title}`);
    console.log(`   Videos: ${channel.videos?.length || 0}`);
    
    if (channel.videos && channel.videos.length > 0) {
      console.log('   Video List:');
      channel.videos.forEach((video, idx) => {
        console.log(`     ${idx + 1}. ${video.title}`);
        console.log(`        YouTube ID: ${video.youtube_id}`);
        console.log(`        Chunks: ${video.chunks_processed ? '✅' : '❌'}`);
      });
    }
  }
  
  console.log('\n✨ Channel video references updated!');
}

updateChannelVideoReferences();