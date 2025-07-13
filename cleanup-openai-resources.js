const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupOpenAIResources() {
  try {
    console.log('🧹 Cleaning up OpenAI resources from channels...\n');
    
    // Get all channels with OpenAI assistant IDs
    const { data: channels, error } = await supabase
      .from('channels')
      .select('id, title, openai_assistant_id, openai_vector_store_id')
      .not('openai_assistant_id', 'is', null);
    
    if (error) {
      console.error('Error fetching channels:', error);
      return;
    }
    
    console.log(`Found ${channels?.length || 0} channels with OpenAI resources`);
    
    if (!channels || channels.length === 0) {
      console.log('✅ No channels need cleanup');
      return;
    }
    
    // Update each channel to remove OpenAI references
    let cleaned = 0;
    for (const channel of channels) {
      console.log(`\nCleaning channel: ${channel.title}`);
      console.log(`  Assistant ID: ${channel.openai_assistant_id}`);
      console.log(`  Vector Store ID: ${channel.openai_vector_store_id || 'None'}`);
      
      // Clear the OpenAI fields
      const { error: updateError } = await supabase
        .from('channels')
        .update({
          openai_assistant_id: null,
          openai_vector_store_id: null
        })
        .eq('id', channel.id);
      
      if (!updateError) {
        cleaned++;
        console.log(`  ✅ Cleared OpenAI references`);
      } else {
        console.error(`  ❌ Failed to update:`, updateError);
      }
    }
    
    console.log(`\n✅ Cleaned ${cleaned} out of ${channels.length} channels`);
    console.log('\n📝 Note: The actual OpenAI resources (assistants and vector stores) need to be deleted manually from the OpenAI dashboard.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanupOpenAIResources();