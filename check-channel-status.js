const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkChannelStatus() {
  console.log('🔍 Checking Channel Processing Status\n');
  
  // Get all channels with their queue status
  const { data: channels } = await supabase
    .from('channels')
    .select(`
      *,
      channel_queue (*),
      videos (
        id,
        youtube_id,
        title,
        chunks_processed,
        created_at
      )
    `)
    .order('created_at', { ascending: false });
  
  if (!channels || channels.length === 0) {
    console.log('No channels found');
    return;
  }
  
  for (const channel of channels) {
    console.log(`\n📺 Channel: ${channel.title}`);
    console.log(`   ID: ${channel.id}`);
    console.log(`   YouTube ID: ${channel.youtube_channel_id}`);
    console.log(`   Status: ${channel.status}`);
    console.log(`   Video Count: ${channel.video_count}`);
    console.log(`   Total Video Count: ${channel.total_video_count || 'N/A'}`);
    
    // Queue info
    if (channel.channel_queue && channel.channel_queue.length > 0) {
      const queue = channel.channel_queue[0];
      console.log(`\n   📋 Queue Status:`);
      console.log(`      Status: ${queue.status}`);
      console.log(`      Videos Processed: ${queue.videos_processed}`);
      console.log(`      Total Videos: ${queue.total_videos || 'N/A'}`);
      console.log(`      Current Video Index: ${queue.current_video_index || 'N/A'}`);
      console.log(`      Current Video: ${queue.current_video_title || 'N/A'}`);
      console.log(`      Started: ${queue.started_at || 'Not started'}`);
      console.log(`      Completed: ${queue.completed_at || 'Not completed'}`);
      console.log(`      Error: ${queue.error_message || 'None'}`);
    }
    
    // Videos
    console.log(`\n   📹 Videos (${channel.videos?.length || 0}):`);
    if (channel.videos && channel.videos.length > 0) {
      for (const video of channel.videos.slice(0, 5)) {
        console.log(`      - ${video.title}`);
        console.log(`        YouTube ID: ${video.youtube_id}`);
        console.log(`        Chunks Processed: ${video.chunks_processed ? '✅' : '❌'}`);
        console.log(`        Created: ${new Date(video.created_at).toLocaleString()}`);
      }
      if (channel.videos.length > 5) {
        console.log(`      ... and ${channel.videos.length - 5} more`);
      }
    }
  }
  
  // Check for chunks
  console.log('\n\n📊 Transcript Chunks Summary:');
  const { count: totalChunks } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   Total chunks in database: ${totalChunks || 0}`);
  
  // Check recent chunks
  const { data: recentChunks } = await supabase
    .from('transcript_chunks')
    .select(`
      video_id,
      chunk_index,
      created_at,
      videos!inner(title)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentChunks && recentChunks.length > 0) {
    console.log('\n   Recent chunks:');
    for (const chunk of recentChunks) {
      console.log(`      - ${chunk.videos.title} (chunk ${chunk.chunk_index})`);
      console.log(`        Created: ${new Date(chunk.created_at).toLocaleString()}`);
    }
  }
}

checkChannelStatus();