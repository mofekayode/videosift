const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixVideoCounts() {
  console.log('🔧 Fixing video counts for channels...\n');
  
  // Get all channels
  const { data: channels } = await supabase
    .from('channels')
    .select('id, title, videos(id)');
  
  for (const channel of channels) {
    const actualVideoCount = channel.videos?.length || 0;
    console.log(`📺 ${channel.title}: ${actualVideoCount} videos`);
    
    // Update the video_count
    const { error } = await supabase
      .from('channels')
      .update({ 
        video_count: actualVideoCount,
        total_video_count: actualVideoCount 
      })
      .eq('id', channel.id);
    
    if (error) {
      console.error(`❌ Error updating ${channel.title}:`, error);
    } else {
      console.log(`✅ Updated ${channel.title} video count to ${actualVideoCount}`);
    }
    
    // Update the channel_queue records
    const { error: queueError } = await supabase
      .from('channel_queue')
      .update({ 
        videos_processed: actualVideoCount,
        total_videos: actualVideoCount 
      })
      .eq('channel_id', channel.id)
      .eq('status', 'completed');
    
    if (queueError) {
      console.error(`❌ Error updating queue for ${channel.title}:`, queueError);
    }
  }
  
  console.log('\n✨ Video counts fixed!');
}

fixVideoCounts();