const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testChannelTables() {
  try {
    console.log('🔍 Testing channel-related tables...\n');
    
    // Test channels table
    console.log('1. Testing channels table:');
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('*')
      .limit(1);
    
    if (channelsError) {
      console.error('❌ Channels table error:', channelsError);
    } else {
      console.log('✅ Channels table exists');
      console.log('   Sample structure:', channels.length > 0 ? Object.keys(channels[0]) : 'No records');
    }
    
    // Test channel_queue table
    console.log('\n2. Testing channel_queue table:');
    const { data: queue, error: queueError } = await supabase
      .from('channel_queue')
      .select('*')
      .limit(1);
    
    if (queueError) {
      console.error('❌ Channel_queue table error:', queueError);
    } else {
      console.log('✅ Channel_queue table exists');
      console.log('   Sample structure:', queue.length > 0 ? Object.keys(queue[0]) : 'No records');
    }
    
    // Test creating a channel record
    console.log('\n3. Testing channel creation:');
    const testChannel = {
      youtube_channel_id: 'TEST_' + Date.now(),
      title: 'Test Channel',
      owner_user_id: '00b9193e-c6c5-48ab-8f9d-77d3e294eb84', // Your user ID
      status: 'pending'
    };
    
    const { data: newChannel, error: createError } = await supabase
      .from('channels')
      .insert([testChannel])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Failed to create channel:', createError);
    } else {
      console.log('✅ Channel created:', newChannel.id);
      
      // Clean up test channel
      await supabase.from('channels').delete().eq('id', newChannel.id);
      console.log('   (Test channel deleted)');
    }
    
    // List existing channels
    console.log('\n4. Existing channels:');
    const { data: allChannels, error: listError } = await supabase
      .from('channels')
      .select('id, title, youtube_channel_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (listError) {
      console.error('❌ Failed to list channels:', listError);
    } else {
      console.log(`Found ${allChannels.length} channels:`);
      allChannels.forEach(ch => {
        console.log(`  - ${ch.title} (${ch.youtube_channel_id}) - Status: ${ch.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testChannelTables();