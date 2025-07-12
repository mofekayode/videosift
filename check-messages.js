const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMessages() {
  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log('Checking messages from', today.toISOString(), 'to', tomorrow.toISOString());

  // Get ALL sessions for today
  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select(`
      id,
      created_at,
      user_id,
      anon_id,
      video_id,
      chat_messages (
        id,
        role,
        content,
        created_at
      )
    `)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 SUMMARY:');
  console.log('Total sessions today:', sessions.length);
  
  let totalUserMessages = 0;
  let totalAssistantMessages = 0;
  
  sessions.forEach((session, i) => {
    const userMessages = session.chat_messages?.filter(m => m.role === 'user') || [];
    const assistantMessages = session.chat_messages?.filter(m => m.role === 'assistant') || [];
    
    totalUserMessages += userMessages.length;
    totalAssistantMessages += assistantMessages.length;
    
    console.log(`\nSession ${i + 1}:`, session.id);
    console.log('  Created:', session.created_at);
    console.log('  User ID:', session.user_id || 'none');
    console.log('  Anon ID:', session.anon_id || 'none');
    console.log('  Video ID:', session.video_id);
    console.log('  Messages:', userMessages.length, 'user,', assistantMessages.length, 'assistant');
    
    if (userMessages.length > 0) {
      console.log('  First message:', userMessages[0].content.substring(0, 50) + '...');
    }
  });

  console.log('\n🎯 TOTAL COUNTS:');
  console.log('User messages today:', totalUserMessages);
  console.log('Assistant messages today:', totalAssistantMessages);
}

checkMessages();