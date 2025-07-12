const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixChatSessions() {
  try {
    console.log('🔍 Finding chat sessions without video_id...');
    
    // Get all sessions without video_id
    const { data: sessions, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id, created_at')
      .is('video_id', null)
      .order('created_at', { ascending: false });
    
    if (sessionError) {
      console.error('Error fetching sessions:', sessionError);
      return;
    }
    
    console.log(`Found ${sessions?.length || 0} sessions without video_id`);
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions need fixing');
      return;
    }
    
    // For each session, try to find the video from context
    let fixed = 0;
    for (const session of sessions) {
      console.log(`\nProcessing session ${session.id}...`);
      
      // Check if we can find video context from messages
      const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .select('content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })
        .limit(5);
      
      if (msgError || !messages || messages.length === 0) {
        console.log('  No messages found for this session');
        continue;
      }
      
      // Look for video mentions in messages
      let videoId = null;
      for (const msg of messages) {
        // Check if message contains video reference
        // This is a placeholder - you might need to adjust based on your data
        console.log('  Message sample:', msg.content.substring(0, 100));
      }
      
      // If we found a video ID, update the session
      if (videoId) {
        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({ video_id: videoId })
          .eq('id', session.id);
        
        if (!updateError) {
          fixed++;
          console.log(`  ✅ Fixed session with video_id: ${videoId}`);
        }
      } else {
        console.log('  ⚠️ Could not determine video_id for this session');
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} out of ${sessions.length} sessions`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixChatSessions();