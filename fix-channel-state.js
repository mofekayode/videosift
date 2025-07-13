const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixChannelState() {
  console.log('🔧 Fixing channel state...\n');
  
  // Reset the channel to pending so it can be reprocessed
  const { error: channelError } = await supabase
    .from('channels')
    .update({ 
      status: 'pending',
      video_count: 0
    })
    .eq('id', 'b474e664-7e3e-4c3d-9c8a-6c16d8e707bc');
  
  if (channelError) {
    console.error('Error updating channel:', channelError);
    return;
  }
  
  // Reset the queue item
  const { error: queueError } = await supabase
    .from('channel_queue')
    .update({ 
      status: 'pending',
      videos_processed: 0,
      started_at: null,
      completed_at: null,
      current_video_index: null,
      current_video_title: null
    })
    .eq('channel_id', 'b474e664-7e3e-4c3d-9c8a-6c16d8e707bc');
  
  if (queueError) {
    console.error('Error updating queue:', queueError);
    return;
  }
  
  // Delete the videos that were created but not processed
  const { error: deleteError } = await supabase
    .from('videos')
    .delete()
    .eq('channel_id', 'b474e664-7e3e-4c3d-9c8a-6c16d8e707bc')
    .eq('chunks_processed', false);
  
  if (deleteError) {
    console.error('Error deleting unprocessed videos:', deleteError);
    return;
  }
  
  console.log('✅ Channel state fixed! The channel is now pending and can be reprocessed properly.');
  console.log('\nYou can now click "Process Pending" to reprocess the channel with the fixed code.');
}

fixChannelState();