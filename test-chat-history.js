const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testChatHistory() {
  try {
    // Test with your user ID
    const userId = '00b9193e-c6c5-48ab-8f9d-77d3e294eb84';
    
    console.log(`🔍 Fetching chat sessions for user: ${userId}`);
    
    // First, get the sessions
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }
    
    // Then fetch video details separately
    for (const session of sessions || []) {
      if (session.video_id) {
        const { data: video } = await supabase
          .from('videos')
          .select('youtube_id, title, thumbnail_url')
          .eq('id', session.video_id)
          .single();
        
        session.video = video;
      }
    }
    
    console.log(`\n✅ Found ${sessions?.length || 0} sessions`);
    
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        console.log('\n📋 Session:', {
          id: session.id,
          video_id: session.video_id,
          video_title: session.video?.title || 'No video',
          created: new Date(session.created_at).toLocaleString()
        });
        
        // Get message count
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);
        
        console.log(`   Messages: ${count || 0}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testChatHistory();