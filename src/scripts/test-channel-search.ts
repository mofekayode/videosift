// Test script for the channel search debug endpoint
// Usage: Copy this into a browser console or run with tsx/node

async function testChannelSearch(channelId: string, searchQuery: string) {
  const response = await fetch('/api/debug/channel-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channelId,
      searchQuery
    })
  });

  const data = await response.json();
  
  console.log('=== CHANNEL SEARCH DEBUG RESULTS ===');
  console.log('Analysis:', data.analysis);
  console.log('\n=== TARGET VIDEO ===');
  console.log('Target video found:', data.targetVideo?.found);
  
  if (data.targetVideo?.found) {
    console.log('Video details:', data.targetVideo.video);
    console.log('Search results:', data.targetVideo.results);
  }
  
  console.log('\n=== VIDEOS WITH SEARCH RESULTS ===');
  data.allResults?.forEach((result: any) => {
    if (result.searchResultCount > 0) {
      console.log(`\nVideo: ${result.video.title}`);
      console.log(`Chunks: ${result.chunkCount}, Results: ${result.searchResultCount}`);
      console.log('Top results:', result.topResults);
    }
  });

  return data;
}

// Example usage:
// testChannelSearch('your-channel-id', 'Hussein Farhat');