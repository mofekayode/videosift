const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllChunks() {
  console.log('🔍 Checking chunk details for all videos...\n');
  
  // Get all videos
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });
  
  console.log(`Found ${videos?.length || 0} total videos in database\n`);
  
  let totalChunks = 0;
  
  for (const video of (videos || [])) {
    console.log(`📹 ${video.title}`);
    console.log(`   YouTube ID: ${video.youtube_id}`);
    console.log(`   Channel ID: ${video.channel_id || 'None'}`);
    console.log(`   Transcript cached: ${video.transcript_cached}`);
    console.log(`   Chunks processed: ${video.chunks_processed}`);
    
    // Get chunks for this video
    const { data: chunks, count } = await supabase
      .from('transcript_chunks')
      .select('chunk_index, start_time, end_time, text', { count: 'exact' })
      .eq('video_id', video.id)
      .order('chunk_index');
    
    console.log(`   Chunks in database: ${count || 0}`);
    
    if (chunks && chunks.length > 0) {
      totalChunks += chunks.length;
      
      // Show first and last chunk info
      const firstChunk = chunks[0];
      const lastChunk = chunks[chunks.length - 1];
      
      console.log(`   First chunk: [${firstChunk.start_time} - ${firstChunk.end_time}]`);
      console.log(`   Last chunk: [${lastChunk.start_time} - ${lastChunk.end_time}]`);
      console.log(`   Avg chunk length: ${Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)} chars`);
    }
    
    console.log('');
  }
  
  console.log(`📊 Total chunks across all videos: ${totalChunks}`);
  
  // Check chunk size distribution
  const { data: chunkSizes } = await supabase
    .from('transcript_chunks')
    .select('text');
  
  if (chunkSizes && chunkSizes.length > 0) {
    const sizes = chunkSizes.map(c => c.text.length);
    const avgSize = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    
    console.log('\n📏 Chunk Size Statistics:');
    console.log(`   Average: ${avgSize} characters`);
    console.log(`   Minimum: ${minSize} characters`);
    console.log(`   Maximum: ${maxSize} characters`);
    console.log(`   Target range: 1000-2000 characters`);
  }
}

checkAllChunks();