const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSessionVideoIds() {
  try {
    console.log('🔧 Fixing chat session video IDs...\n');
    
    // Get all unique YouTube IDs from sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('video_id')
      .not('video_id', 'is', null);
    
    if (sessionError) {
      console.error('Error fetching sessions:', sessionError);
      return;
    }
    
    // Get unique video IDs that look like YouTube IDs (not UUIDs)
    const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
    const youtubeIds = [...new Set(sessions
      .map(s => s.video_id)
      .filter(id => id && youtubeIdPattern.test(id)))];
    
    console.log(`Found ${youtubeIds.length} YouTube IDs to convert`);
    
    if (youtubeIds.length === 0) {
      console.log('✅ All sessions already use proper video UUIDs');
      return;
    }
    
    // For each YouTube ID, find the corresponding UUID
    const idMapping = {};
    for (const youtubeId of youtubeIds) {
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('id')
        .eq('youtube_id', youtubeId)
        .single();
      
      if (video) {
        idMapping[youtubeId] = video.id;
        console.log(`  ${youtubeId} -> ${video.id}`);
      } else {
        console.log(`  ⚠️ No video found for YouTube ID: ${youtubeId}`);
      }
    }
    
    // Update all sessions with the correct UUIDs
    let updated = 0;
    for (const [youtubeId, uuid] of Object.entries(idMapping)) {
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ video_id: uuid })
        .eq('video_id', youtubeId);
      
      if (!updateError) {
        const { count } = await supabase
          .from('chat_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', uuid);
        
        updated += count || 0;
      } else {
        console.error(`Failed to update sessions for ${youtubeId}:`, updateError);
      }
    }
    
    console.log(`\n✅ Updated ${updated} sessions with proper video UUIDs`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixSessionVideoIds();