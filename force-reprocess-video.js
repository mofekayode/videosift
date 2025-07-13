const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceReprocessVideo() {
  const videoId = 'pbHxIpo0mkw'; // Dropbox video
  
  console.log(`🔧 Force reprocessing video: ${videoId}\n`);
  
  // First, mark the video as not processed
  const { error } = await supabase
    .from('videos')
    .update({ 
      chunks_processed: false,
      transcript_cached: false 
    })
    .eq('youtube_id', videoId);
  
  if (error) {
    console.error('Error updating video:', error);
    return;
  }
  
  console.log('✅ Video marked for reprocessing');
  console.log('\nNow calling transcript-quick endpoint...\n');
  
  // Now process it
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const response = await fetch('http://localhost:3001/api/video/transcript-quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId })
  });
  
  const result = await response.json();
  console.log('Response:', result);
  
  // Check chunks again
  const { data: video } = await supabase
    .from('videos')
    .select('id')
    .eq('youtube_id', videoId)
    .single();
  
  if (video) {
    const { count } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);
    
    console.log(`\n📊 Chunks in database after processing: ${count || 0}`);
  }
}

forceReprocessVideo();