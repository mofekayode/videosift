/**
 * Post-retrieval filtering to ensure we find the most relevant chunks
 * This runs AFTER text has been loaded from storage
 */

export function filterChunksByContent(
  chunks: Array<{ text?: string; [key: string]: any }>,
  query: string
): Array<{ text?: string; [key: string]: any }> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
  
  // Score each chunk based on content relevance
  const scoredChunks = chunks.map(chunk => {
    let score = chunk.similarity || 0; // Start with semantic similarity
    
    if (!chunk.text) {
      return { ...chunk, finalScore: score };
    }
    
    const textLower = chunk.text.toLowerCase();
    
    // Boost if the full query appears in the text
    if (textLower.includes(queryLower)) {
      score += 0.5;
    }
    
    // Boost for each query word that appears
    const wordMatches = queryWords.filter(word => textLower.includes(word)).length;
    score += (wordMatches / queryWords.length) * 0.3;
    
    // Extra boost if the chunk contains a person's name (first + last name together)
    if (queryWords.length >= 2) {
      const possibleNames = [];
      for (let i = 0; i < queryWords.length - 1; i++) {
        possibleNames.push(`${queryWords[i]} ${queryWords[i + 1]}`);
      }
      
      const hasFullName = possibleNames.some(name => textLower.includes(name));
      if (hasFullName) {
        score += 0.4;
      }
    }
    
    // Boost if chunk appears to be from a video title that matches
    if (chunk.video_title) {
      const titleLower = chunk.video_title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 0.3;
      }
      const titleWordMatches = queryWords.filter(word => titleLower.includes(word)).length;
      score += (titleWordMatches / queryWords.length) * 0.2;
    }
    
    return { ...chunk, finalScore: score };
  });
  
  // Sort by final score and return
  return scoredChunks.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Groups chunks by video and ensures we get good coverage across relevant videos
 */
export function balanceChunksByVideo(
  chunks: Array<{ video_youtube_id: string; video_title: string; [key: string]: any }>,
  maxChunksPerVideo: number = 5,
  totalLimit: number = 30
): Array<any> {
  // Group chunks by video
  const videoGroups = new Map<string, Array<any>>();
  
  chunks.forEach(chunk => {
    const videoId = chunk.video_youtube_id;
    if (!videoGroups.has(videoId)) {
      videoGroups.set(videoId, []);
    }
    videoGroups.get(videoId)!.push(chunk);
  });
  
  // Take top chunks from each video
  const balancedChunks: Array<any> = [];
  
  // First pass: ensure at least 1 chunk from each video (if available)
  videoGroups.forEach((videoChunks, videoId) => {
    if (videoChunks.length > 0) {
      balancedChunks.push(videoChunks[0]); // Add the most relevant chunk from each video
    }
  });
  
  // Second pass: add more chunks up to maxChunksPerVideo from each video
  videoGroups.forEach((videoChunks, videoId) => {
    const additionalChunks = videoChunks.slice(1, maxChunksPerVideo);
    balancedChunks.push(...additionalChunks);
  });
  
  // If we're under the limit, add more chunks from the most relevant videos
  if (balancedChunks.length < totalLimit) {
    const remainingSlots = totalLimit - balancedChunks.length;
    const additionalChunks: Array<any> = [];
    
    videoGroups.forEach((videoChunks, videoId) => {
      if (videoChunks.length > maxChunksPerVideo) {
        additionalChunks.push(...videoChunks.slice(maxChunksPerVideo));
      }
    });
    
    // Sort additional chunks by score and add the best ones
    additionalChunks.sort((a, b) => (b.finalScore || b.similarity || 0) - (a.finalScore || a.similarity || 0));
    balancedChunks.push(...additionalChunks.slice(0, remainingSlots));
  }
  
  // Final sort by relevance while maintaining some video diversity
  return balancedChunks.slice(0, totalLimit);
}