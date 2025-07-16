// Deploy this as a separate service on Railway/Render
// It runs continuously and processes channels immediately

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function watchQueue() {
  console.log('🚀 Channel processor worker started');
  
  // Check for new channels every 5 seconds
  setInterval(async () => {
    try {
      const { data: pendingChannels } = await supabase
        .from('channel_queue')
        .select('id')
        .eq('status', 'pending')
        .limit(1);
      
      if (pendingChannels && pendingChannels.length > 0) {
        console.log('📋 Found pending channels, processing...');
        await processChannelQueue();
      }
    } catch (error) {
      console.error('Worker error:', error);
    }
  }, 5000); // Check every 5 seconds
}

// Start the worker
watchQueue();

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});