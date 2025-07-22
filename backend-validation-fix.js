// ADD THIS VALIDATION TO YOUR BACKEND'S channel creation code

// When creating a channel, validate the YouTube channel ID:
function validateYouTubeChannelId(channelId) {
  // YouTube channel IDs must start with 'UC' or 'HC' and be exactly 24 characters
  const isValid = /^(UC|HC)[a-zA-Z0-9_-]{22}$/.test(channelId);
  
  if (!isValid) {
    console.error('❌ Invalid YouTube channel ID:', channelId);
    console.error('Expected format: UC/HC followed by 22 alphanumeric characters');
    return false;
  }
  
  return true;
}

// Before inserting into the database:
async function createChannel(channelData) {
  // Validate YouTube channel ID
  if (!validateYouTubeChannelId(channelData.youtube_channel_id)) {
    throw new Error('Invalid YouTube channel ID format');
  }
  
  // Check if channel already exists
  const existing = await supabase
    .from('channels')
    .select('*')
    .eq('youtube_channel_id', channelData.youtube_channel_id)
    .single();
    
  if (existing.data) {
    console.log('Channel already exists:', existing.data);
    return existing.data;
  }
  
  // Create new channel
  const { data, error } = await supabase
    .from('channels')
    .insert({
      youtube_channel_id: channelData.youtube_channel_id,
      title: channelData.title,
      status: 'pending'
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// When processing a channel URL like "@ycombinator":
async function resolveChannelId(channelIdentifier) {
  // If already a valid channel ID, return it
  if (channelIdentifier.startsWith('UC') || channelIdentifier.startsWith('HC')) {
    return channelIdentifier;
  }
  
  // Otherwise, search YouTube API
  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelIdentifier)}&maxResults=1&key=${YOUTUBE_API_KEY}`
  );
  
  const searchData = await searchResponse.json();
  
  if (!searchData.items || searchData.items.length === 0) {
    throw new Error('Channel not found');
  }
  
  const actualChannelId = searchData.items[0].id.channelId;
  
  // Validate the resolved ID
  if (!validateYouTubeChannelId(actualChannelId)) {
    throw new Error('YouTube API returned invalid channel ID');
  }
  
  return actualChannelId;
}