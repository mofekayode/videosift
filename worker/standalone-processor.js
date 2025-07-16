import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple implementation of channel processing
async function processChannels() {
  try {
    // Get pending channels
    const { data: queueItems, error } = await supabase
      .from('channel_queue')
      .select(`
        *,
        channels (
          id,
          youtube_channel_id,
          title
        )
      `)
      .eq('status', 'pending')
      .limit(1);

    if (error || !queueItems || queueItems.length === 0) {
      return;
    }

    const queueItem = queueItems[0];
    console.log(`🚀 Processing channel: ${queueItem.channels?.title || queueItem.channel_id}`);

    // Mark as processing
    await supabase
      .from('channel_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', queueItem.id);

    // HERE: Call your processing API endpoint
    const response = await fetch(`${process.env.APP_URL}/api/internal/process-channel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        queueId: queueItem.id,
        channelId: queueItem.channel_id
      })
    });

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.status}`);
    }

    console.log(`✅ Channel processing triggered for ${queueItem.channels?.title}`);
    
  } catch (error) {
    console.error('❌ Processing error:', error);
  }
}

// Main loop
async function start() {
  console.log('🤖 VidSift Worker Started');
  console.log('⏰ Checking for channels every 5 seconds...');
  
  // Check immediately on start
  await processChannels();
  
  // Then check every 5 seconds
  setInterval(processChannels, 5000);
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('👋 Worker shutting down...');
  process.exit(0);
});

// Start the worker
start();