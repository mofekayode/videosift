const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function reprocessVideo(youtubeId) {
  try {
    console.log(`🔄 Looking up video with YouTube ID: ${youtubeId}`);
    
    // First get the video UUID
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, title')
      .eq('youtube_id', youtubeId)
      .single();
    
    if (videoError || !video) {
      console.error('Video not found:', videoError);
      return;
    }
    
    console.log(`📺 Found video: ${video.title} (${video.id})`);
    
    // 1. Delete existing chunks
    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .eq('video_id', video.id);
    
    if (deleteError) {
      console.error('Failed to delete chunks:', deleteError);
    } else {
      console.log('✅ Deleted existing chunks');
    }
    
    // 2. Update video to trigger reprocessing
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        chunks_processed: false,
        transcript_cached: false
      })
      .eq('id', videoId);
    
    if (updateError) {
      console.error('Failed to update video:', updateError);
    } else {
      console.log('✅ Reset video processing flags');
    }
    
    console.log('\n📝 Video marked for reprocessing.');
    console.log('The next transcript request will process with larger chunks.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get video ID from command line
const videoId = process.argv[2];
if (!videoId) {
  console.log('Usage: node reprocess-video.js <video_id>');
  console.log('Example: node reprocess-video.js BHO_glbVcIg');
  process.exit(1);
}

reprocessVideo(videoId);