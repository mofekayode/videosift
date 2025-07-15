/**
 * Debug utilities for channel search
 */

export function logSearchCoverage(
  channelVideos: Array<{ id: string; title: string; youtube_id: string }>,
  searchResults: Array<Array<any>>,
  topChunks: Array<any>
) {
  console.log('\n=== CHANNEL SEARCH COVERAGE DEBUG ===');
  
  // Map video IDs to titles
  const videoMap = new Map(channelVideos.map(v => [v.id, v.title]));
  
  // Check which videos had search results
  const videosWithResults = new Set<string>();
  const videoChunkCounts = new Map<string, number>();
  
  searchResults.forEach((videoResults, index) => {
    if (videoResults.length > 0) {
      const videoId = channelVideos[index].id;
      videosWithResults.add(videoId);
      videoChunkCounts.set(videoId, videoResults.length);
    }
  });
  
  // Check which videos made it to final selection
  const videosInFinalSelection = new Set<string>();
  const finalVideoChunkCounts = new Map<string, number>();
  
  topChunks.forEach(chunk => {
    const videoId = chunk.video_id;
    videosInFinalSelection.add(videoId);
    finalVideoChunkCounts.set(videoId, (finalVideoChunkCounts.get(videoId) || 0) + 1);
  });
  
  // Log summary
  console.log(`Total videos in channel: ${channelVideos.length}`);
  console.log(`Videos with search results: ${videosWithResults.size}`);
  console.log(`Videos in final selection: ${videosInFinalSelection.size}`);
  console.log(`Total chunks selected: ${topChunks.length}`);
  
  // Log videos missing from search
  console.log('\nVideos with NO search results:');
  channelVideos.forEach(video => {
    if (!videosWithResults.has(video.id)) {
      console.log(`  ❌ ${video.title}`);
    }
  });
  
  // Log videos missing from final selection
  console.log('\nVideos NOT in final selection:');
  channelVideos.forEach(video => {
    if (videosWithResults.has(video.id) && !videosInFinalSelection.has(video.id)) {
      console.log(`  ⚠️  ${video.title} (had ${videoChunkCounts.get(video.id)} chunks in search)`);
    }
  });
  
  // Log chunk distribution
  console.log('\nChunk distribution in final selection:');
  finalVideoChunkCounts.forEach((count, videoId) => {
    const title = videoMap.get(videoId) || 'Unknown';
    console.log(`  📹 ${title}: ${count} chunks`);
  });
  
  console.log('=================================\n');
}